import { Hono } from "hono";
import type {
	AccountTier,
	FeedbackItem,
	FeedbackSource,
	ProductArea,
	Region,
} from "../shared/types";

const app = new Hono<{ Bindings: Env }>();

type HealthCheckRow = {
	ok: number;
};

function jsonError(
	message: string,
	status: number,
	code: string = "bad_request",
) {
	return Response.json({ error: { code, message } }, { status });
}

function parseIntParam(
	value: string | undefined,
	{ fallback, min, max }: { fallback: number; min: number; max: number },
): number {
	if (!value) return fallback;
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function sha256Hex(input: string): Promise<string> {
	const bytes = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

const FEEDBACK_SOURCES: ReadonlySet<FeedbackSource> = new Set([
	"support",
	"github",
	"discord",
	"email",
	"twitter",
	"forum",
]);

const ACCOUNT_TIERS: ReadonlySet<AccountTier> = new Set([
	"free",
	"pro",
	"business",
	"enterprise",
]);

const PRODUCT_AREAS: ReadonlySet<ProductArea> = new Set([
	"workers",
	"zero_trust",
	"waf",
	"dns",
	"analytics",
	"billing",
	"dashboard",
	"vectorize",
	"d1",
]);

const REGIONS: ReadonlySet<Region> = new Set(["NA", "EU", "APAC", "LATAM"]);

app.get("/api", (c) =>
	c.json({
		name: "feedbacktool",
		status: "ok",
	}),
);

app.get("/api/health", async (c) => {
	try {
		const result = await c.env.DB.prepare("SELECT 1 AS ok").first<HealthCheckRow>();

		return c.json({
			status: "ok",
			time: new Date().toISOString(),
			database: result?.ok === 1 ? "connected" : "unknown",
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown database error";

		return c.json(
			{
				error: {
					code: "database_unavailable",
					message,
				},
			},
			500,
		);
	}
});

app.post("/api/ingest", async (c) => {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return jsonError("Invalid JSON body.", 400);
	}

	if (!isRecord(body) || !Array.isArray(body.items)) {
		return jsonError('Expected body shape: { "items": FeedbackItem[] }', 400);
	}

	const items = body.items as unknown[];
	if (items.length === 0) return c.json({ inserted: 0, skipped: 0 });
	if (items.length > 1000) return jsonError("Too many items in one request.", 413);

	const ingestedAt = new Date().toISOString();

	const stmt = c.env.DB.prepare(
		[
			"INSERT OR IGNORE INTO feedback_items (",
			"id, source, source_ref, url, author, account_tier, product_area,",
			"created_at, ingested_at, location_region, location_country, location_colo,",
			"text, text_hash, metadata_json",
			") VALUES (",
			"?, ?, ?, ?, ?, ?, ?,",
			"?, ?, ?, ?, ?,",
			"?, ?, ?",
			")",
		].join(" "),
	);

	const batch: Array<ReturnType<typeof stmt.bind>> = [];

	for (const [idx, raw] of items.entries()) {
		if (!isRecord(raw)) {
			return jsonError(`Item at index ${idx} must be an object.`, 400);
		}
		const id = raw.id;
		const source = raw.source;
		const createdAt = raw.created_at;
		const text = raw.text;

		if (typeof id !== "string" || id.trim() === "") {
			return jsonError(`Item at index ${idx} is missing required field: id`, 400);
		}
		if (
			typeof source !== "string" ||
			!FEEDBACK_SOURCES.has(source as FeedbackSource)
		) {
			return jsonError(
				`Item at index ${idx} has invalid required field: source`,
				400,
			);
		}
		if (typeof createdAt !== "string" || createdAt.trim() === "") {
			return jsonError(
				`Item at index ${idx} is missing required field: created_at`,
				400,
			);
		}
		if (typeof text !== "string" || text.trim() === "") {
			return jsonError(`Item at index ${idx} is missing required field: text`, 400);
		}

		const sourceRef =
			typeof raw.source_ref === "string" ? raw.source_ref : null;
		const url = typeof raw.url === "string" ? raw.url : null;
		const author = typeof raw.author === "string" ? raw.author : null;

		const accountTier =
			typeof raw.account_tier === "string" &&
			ACCOUNT_TIERS.has(raw.account_tier as AccountTier)
				? raw.account_tier
				: null;

		const productArea =
			typeof raw.product_area === "string" &&
			PRODUCT_AREAS.has(raw.product_area as ProductArea)
				? raw.product_area
				: null;

		const locationRegion =
			typeof raw.location_region === "string" &&
			REGIONS.has(raw.location_region as Region)
				? raw.location_region
				: null;

		const locationCountry =
			typeof raw.location_country === "string" ? raw.location_country : null;
		const locationColo =
			typeof raw.location_colo === "string" ? raw.location_colo : null;

		const metadata = isRecord(raw.metadata) ? raw.metadata : {};
		const metadataJson = JSON.stringify(metadata);
		const textHash = await sha256Hex(text);

		batch.push(
			stmt.bind(
				id,
				source,
				sourceRef,
				url,
				author,
				accountTier,
				productArea,
				createdAt,
				ingestedAt,
				locationRegion,
				locationCountry,
				locationColo,
				text,
				textHash,
				metadataJson,
			),
		);
	}

	if (batch.length === 0) return c.json({ inserted: 0, skipped: 0 });

	try {
		const results = await c.env.DB.batch(batch);
		const inserted = results.reduce(
			(sum, r) => sum + (r.meta?.changes ?? 0),
			0,
		);
		const skipped = items.length - inserted;
		return c.json({ inserted, skipped });
	} catch (err) {
		console.error("ingest failed:", err);
		return jsonError("Failed to ingest items.", 500, "internal_error");
	}
});

app.get("/api/items", async (c) => {
	const limit = parseIntParam(c.req.query("limit"), {
		fallback: 50,
		min: 1,
		max: 200,
	});
	const offset = parseIntParam(c.req.query("offset"), {
		fallback: 0,
		min: 0,
		max: Number.MAX_SAFE_INTEGER,
	});

	const source = c.req.query("source");
	const productArea = c.req.query("product_area");
	const accountTier = c.req.query("account_tier");
	const from = c.req.query("from");
	const to = c.req.query("to");

	if (source && !FEEDBACK_SOURCES.has(source as FeedbackSource)) {
		return jsonError("Invalid source filter.", 400);
	}
	if (productArea && !PRODUCT_AREAS.has(productArea as ProductArea)) {
		return jsonError("Invalid product_area filter.", 400);
	}
	if (accountTier && !ACCOUNT_TIERS.has(accountTier as AccountTier)) {
		return jsonError("Invalid account_tier filter.", 400);
	}
	if (from && typeof from !== "string") return jsonError("Invalid from.", 400);
	if (to && typeof to !== "string") return jsonError("Invalid to.", 400);

	const where: string[] = [];
	const binds: unknown[] = [];

	if (source) {
		where.push("source = ?");
		binds.push(source);
	}
	if (productArea) {
		where.push("product_area = ?");
		binds.push(productArea);
	}
	if (accountTier) {
		where.push("account_tier = ?");
		binds.push(accountTier);
	}
	if (from) {
		where.push("created_at >= ?");
		binds.push(from);
	}
	if (to) {
		where.push("created_at <= ?");
		binds.push(to);
	}

	const sql =
		[
			"SELECT",
			"id, source, source_ref, url, author, account_tier, product_area,",
			"created_at, ingested_at, location_region, location_country, location_colo,",
			"text, metadata_json",
			"FROM feedback_items",
			where.length ? `WHERE ${where.join(" AND ")}` : "",
			"ORDER BY created_at DESC",
			"LIMIT ? OFFSET ?",
		]
			.filter(Boolean)
			.join(" ") + ";";

	try {
		const results = await c.env.DB.prepare(sql)
			.bind(...binds, limit, offset)
			.all<{
				id: string;
				source: FeedbackSource;
				source_ref: string | null;
				url: string | null;
				author: string | null;
				account_tier: AccountTier | null;
				product_area: ProductArea | null;
				created_at: string;
				ingested_at: string;
				location_region: Region | null;
				location_country: string | null;
				location_colo: string | null;
				text: string;
				metadata_json: string | null;
			}>();

		const items = (results.results ?? []).map((r) => {
			let metadata: Record<string, unknown> = {};
			if (typeof r.metadata_json === "string" && r.metadata_json.length) {
				try {
					const parsed = JSON.parse(r.metadata_json) as unknown;
					if (isRecord(parsed)) metadata = parsed;
				} catch {
					metadata = {};
				}
			}

			const out: FeedbackItem & { ingested_at: string } = {
				id: r.id,
				source: r.source,
				source_ref: r.source_ref ?? undefined,
				url: r.url ?? undefined,
				author: r.author ?? undefined,
				account_tier: r.account_tier ?? undefined,
				product_area: r.product_area ?? undefined,
				created_at: r.created_at,
				location_region: r.location_region ?? undefined,
				location_country: r.location_country ?? undefined,
				location_colo: r.location_colo ?? undefined,
				text: r.text,
				metadata,
				ingested_at: r.ingested_at,
			};
			return out;
		});

		const next_offset = items.length === limit ? offset + limit : null;
		return c.json({ items, next_offset });
	} catch (err) {
		console.error("items query failed:", err);
		return jsonError("Failed to fetch items.", 500, "internal_error");
	}
});

export default app;
