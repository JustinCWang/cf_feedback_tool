import { Hono } from "hono";
import type {
	AccountTier,
	FeedbackItem,
	FeedbackSource,
	ProductArea,
	Region,
	Sentiment,
	Urgency,
} from "../shared/types";

type WorkerBindings = Env & {
	AI: Ai<Record<string, BaseAiTextGeneration>>;
};

const app = new Hono<{ Bindings: WorkerBindings }>();

type HealthCheckRow = {
	ok: number;
};

type CountRow = {
	key: string | null;
	count: number | string;
};

type TotalsRow = {
	total_items: number | string;
	items_last_24h: number | string | null;
	items_last_7d: number | string | null;
	active_sources: number | string;
	active_product_areas: number | string;
	latest_ingested_at: string | null;
};

type TotalCountRow = {
	total_count: number | string;
};

type ThemeTimelineRow = {
	bucket: string;
	waf_false_positive: number | string;
	sso_loop: number | string;
	analytics_delay: number | string;
};

type AnalyzeTargetRow = {
	id: string;
	text: string;
	metadata_json: string | null;
};

type AnalyzeRequest = {
	scope?: "unprocessed";
	steps?: {
		classify?: boolean;
	};
	limits?: {
		max_items?: number;
	};
};

type ThemeFamily =
	| "Auth"
	| "Billing"
	| "Docs"
	| "Performance"
	| "Deploy"
	| "Analytics"
	| "Permissions"
	| "UX"
	| "Bug"
	| "FeatureRequest";

type ClassificationResult = {
	sentiment: Sentiment;
	urgency: Urgency;
	theme_family: ThemeFamily;
	theme_label: string;
	confidence: number;
	rationale: string;
	model: string;
	verifier_used: boolean;
};

type ModelClassification = Omit<ClassificationResult, "model" | "verifier_used">;

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

function parseMetadataJson(value: string | null | undefined): Record<string, unknown> {
	if (!value) return {};
	try {
		const parsed = JSON.parse(value) as unknown;
		return isRecord(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function hasKeyword(text: string, keywords: readonly string[]): boolean {
	const normalized = text.toLowerCase();
	return keywords.some((keyword) => normalized.includes(keyword));
}

function wordCount(text: string): number {
	return text
		.trim()
		.split(/\s+/)
		.filter(Boolean).length;
}

function isValidSentiment(value: unknown): value is Sentiment {
	return typeof value === "string" && SENTIMENTS.includes(value as Sentiment);
}

function isValidUrgency(value: unknown): value is Urgency {
	return typeof value === "string" && URGENCY_LEVELS.includes(value as Urgency);
}

function isValidThemeFamily(value: unknown): value is ThemeFamily {
	return typeof value === "string" && THEME_FAMILIES.includes(value as ThemeFamily);
}

function validateModelClassification(
	value: unknown,
): { ok: true; value: ModelClassification } | { ok: false; reason: string } {
	if (!isRecord(value)) {
		return { ok: false, reason: "Model output was not a JSON object." };
	}

	const sentiment = value.sentiment;
	const urgency = value.urgency;
	const themeFamily = value.theme_family;
	const themeLabel = value.theme_label;
	const confidence = value.confidence;
	const rationale = value.rationale;

	if (!isValidSentiment(sentiment)) {
		return { ok: false, reason: "Invalid sentiment returned by model." };
	}
	if (!isValidUrgency(urgency)) {
		return { ok: false, reason: "Invalid urgency returned by model." };
	}
	if (!isValidThemeFamily(themeFamily)) {
		return { ok: false, reason: "Invalid theme_family returned by model." };
	}
	if (typeof themeLabel !== "string" || themeLabel.trim() === "") {
		return { ok: false, reason: "theme_label must be a non-empty string." };
	}
	if (wordCount(themeLabel) > 6) {
		return { ok: false, reason: "theme_label exceeded six words." };
	}
	if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
		return { ok: false, reason: "confidence must be between 0 and 1." };
	}
	if (typeof rationale !== "string" || rationale.trim() === "") {
		return { ok: false, reason: "rationale must be a short string." };
	}

	return {
		ok: true,
		value: {
			sentiment,
			urgency,
			theme_family: themeFamily,
			theme_label: themeLabel.trim(),
			confidence,
			rationale: rationale.trim(),
		},
	};
}

function parseAiJsonResponse(payload: AiTextGenerationOutput): unknown {
	const raw = payload.response;
	if (typeof raw !== "string") return raw;
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return raw;
	}
}

function violatesUrgencyGuardrails(
	text: string,
	classification: ModelClassification,
): boolean {
	const highUrgencySignal = hasKeyword(text, HIGH_URGENCY_KEYWORDS);
	if (highUrgencySignal && classification.urgency === "low") {
		return true;
	}

	const praiseOnlyOrFeatureRequest =
		hasKeyword(text, NON_BLOCKING_SIGNALS) && !hasKeyword(text, BLOCKER_SIGNALS);
	if (praiseOnlyOrFeatureRequest && classification.urgency === "high") {
		return true;
	}

	return false;
}

async function runClassificationModel(
	env: WorkerBindings,
	model: string,
	text: string,
): Promise<ModelClassification> {
	const response = await env.AI.run(model, {
		messages: [
			{
				role: "system",
				content: [
					"You classify product feedback into strict JSON.",
					"Return only fields required by the schema.",
					"Use one theme_family from the allowed list.",
					"Keep theme_label concise, concrete, and at most 6 words.",
					"Urgency should reflect operational impact, not just negative tone.",
					"Rationale must be one short sentence.",
				].join(" "),
			},
			{
				role: "user",
				content: [
					"Classify this feedback item.",
					"",
					`Feedback text: """${text}"""`,
					"",
					"Urgency guardrails:",
					"- If the text mentions outage, blocker, security, billing charge, or similar harm, urgency cannot be low.",
					"- If the text is praise-only or a feature request with no blocker language, urgency cannot be high.",
				].join("\n"),
			},
		],
		response_format: {
			type: "json_schema",
			json_schema: CLASSIFICATION_SCHEMA,
		},
		max_tokens: 220,
		temperature: 0.2,
	});

	const validation = validateModelClassification(parseAiJsonResponse(response));
	if (!validation.ok) {
		throw new Error(validation.reason);
	}

	return validation.value;
}

async function classifyWithVerifierFallback(
	env: WorkerBindings,
	text: string,
): Promise<ClassificationResult> {
	let verifierUsed = false;
	let selectedModel = PRIMARY_MODEL;

	try {
		const primary = await runClassificationModel(env, PRIMARY_MODEL, text);
		if (!violatesUrgencyGuardrails(text, primary) && primary.confidence >= 0.6) {
			return {
				...primary,
				model: PRIMARY_MODEL,
				verifier_used: false,
			};
		}
	} catch {
		// Fall through to verifier. JSON Mode can fail when the schema cannot be met.
	}

	verifierUsed = true;
	selectedModel = VERIFIER_MODEL;
	const verifier = await runClassificationModel(env, VERIFIER_MODEL, text);

	return {
		...verifier,
		model: selectedModel,
		verifier_used: verifierUsed,
	};
}

async function sha256Hex(input: string): Promise<string> {
	const bytes = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function toCount(value: number | string | null | undefined): number {
	if (typeof value === "number") return value;
	if (typeof value === "string") return Number.parseInt(value, 10) || 0;
	return 0;
}

async function queryBreakdown(
	statement: D1PreparedStatement,
): Promise<Array<{ key: string; count: number }>> {
	const result = await statement.all<CountRow>();
	return (result.results ?? [])
		.filter((row) => typeof row.key === "string" && row.key.length > 0)
		.map((row) => ({
			key: row.key as string,
			count: toCount(row.count),
		}));
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

const PRIMARY_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const VERIFIER_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const SENTIMENTS: readonly Sentiment[] = ["positive", "neutral", "negative"];
const URGENCY_LEVELS: readonly Urgency[] = ["low", "medium", "high"];
const THEME_FAMILIES: readonly ThemeFamily[] = [
	"Auth",
	"Billing",
	"Docs",
	"Performance",
	"Deploy",
	"Analytics",
	"Permissions",
	"UX",
	"Bug",
	"FeatureRequest",
];

const HIGH_URGENCY_KEYWORDS = [
	"outage",
	"down",
	"blocker",
	"blocked",
	"blocking",
	"security",
	"breach",
	"charge",
	"charged",
	"invoice",
	"billing",
	"refund",
	"fraud",
];

const NON_BLOCKING_SIGNALS = [
	"love",
	"great",
	"nice",
	"thanks",
	"thank you",
	"feature request",
	"would love",
	"please add",
	"please support",
	"wish",
];

const BLOCKER_SIGNALS = [
	"broken",
	"failing",
	"failure",
	"can't",
	"cannot",
	"unable",
	"issue",
	"incident",
	"error",
	"blocked",
	"outage",
	"loop",
	"403",
	"500",
];

const CLASSIFICATION_SCHEMA = {
	type: "object",
	properties: {
		sentiment: {
			type: "string",
			enum: [...SENTIMENTS],
		},
		urgency: {
			type: "string",
			enum: [...URGENCY_LEVELS],
		},
		theme_family: {
			type: "string",
			enum: [...THEME_FAMILIES],
		},
		theme_label: {
			type: "string",
		},
		confidence: {
			type: "number",
			minimum: 0,
			maximum: 1,
		},
		rationale: {
			type: "string",
		},
	},
	required: [
		"sentiment",
		"urgency",
		"theme_family",
		"theme_label",
		"confidence",
		"rationale",
	],
	additionalProperties: false,
} as const;

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

app.get("/api/overview", async (c) => {
	const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

	try {
		const totals = await c.env.DB.prepare(
			[
				"SELECT",
				"COUNT(*) AS total_items,",
				"SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS items_last_24h,",
				"SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS items_last_7d,",
				"COUNT(DISTINCT source) AS active_sources,",
				"COUNT(DISTINCT product_area) AS active_product_areas,",
				"MAX(ingested_at) AS latest_ingested_at",
				"FROM feedback_items",
			].join(" "),
		)
			.bind(last24h, last7d)
			.first<TotalsRow>();

		const [bySource, byProductArea, byAccountTier, topThemes] = await Promise.all([
			queryBreakdown(
				c.env.DB.prepare(
					[
						"SELECT source AS key, COUNT(*) AS count",
						"FROM feedback_items",
						"GROUP BY source",
						"ORDER BY count DESC, key ASC",
						"LIMIT 6",
					].join(" "),
				),
			),
			queryBreakdown(
				c.env.DB.prepare(
					[
						"SELECT product_area AS key, COUNT(*) AS count",
						"FROM feedback_items",
						"WHERE product_area IS NOT NULL",
						"GROUP BY product_area",
						"ORDER BY count DESC, key ASC",
						"LIMIT 8",
					].join(" "),
				),
			),
			queryBreakdown(
				c.env.DB.prepare(
					[
						"SELECT account_tier AS key, COUNT(*) AS count",
						"FROM feedback_items",
						"WHERE account_tier IS NOT NULL",
						"GROUP BY account_tier",
						"ORDER BY count DESC, key ASC",
						"LIMIT 4",
					].join(" "),
				),
			),
			queryBreakdown(
				c.env.DB.prepare(
					[
						"SELECT json_extract(metadata_json, '$.theme') AS key, COUNT(*) AS count",
						"FROM feedback_items",
						"WHERE json_extract(metadata_json, '$.theme') IS NOT NULL",
						"GROUP BY json_extract(metadata_json, '$.theme')",
						"ORDER BY count DESC, key ASC",
						"LIMIT 5",
					].join(" "),
				),
			),
		]);

		return c.json({
			totals: {
				total_items: toCount(totals?.total_items),
				items_last_24h: toCount(totals?.items_last_24h),
				items_last_7d: toCount(totals?.items_last_7d),
				active_sources: toCount(totals?.active_sources),
				active_product_areas: toCount(totals?.active_product_areas),
				latest_ingested_at: totals?.latest_ingested_at ?? null,
			},
			by_source: bySource,
			by_product_area: byProductArea,
			by_account_tier: byAccountTier,
			top_themes: topThemes,
		});
	} catch (error) {
		console.error("overview query failed:", error);
		return jsonError("Failed to fetch overview.", 500, "internal_error");
	}
});

app.get("/api/trends", async (c) => {
	const last14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

	try {
		const [dailyVolumeResult, sourceBreakdown, productAreaBreakdown, tierBreakdown] =
			await Promise.all([
				c.env.DB.prepare(
					[
						"SELECT substr(created_at, 1, 10) AS key, COUNT(*) AS count",
						"FROM feedback_items",
						"WHERE created_at >= ?",
						"GROUP BY substr(created_at, 1, 10)",
						"ORDER BY key ASC",
					].join(" "),
				)
					.bind(last14d)
					.all<CountRow>(),
				queryBreakdown(
					c.env.DB.prepare(
						[
							"SELECT source AS key, COUNT(*) AS count",
							"FROM feedback_items",
							"GROUP BY source",
							"ORDER BY count DESC, key ASC",
							"LIMIT 6",
						].join(" "),
					),
				),
				queryBreakdown(
					c.env.DB.prepare(
						[
							"SELECT product_area AS key, COUNT(*) AS count",
							"FROM feedback_items",
							"WHERE product_area IS NOT NULL",
							"GROUP BY product_area",
							"ORDER BY count DESC, key ASC",
							"LIMIT 8",
						].join(" "),
					),
				),
				queryBreakdown(
					c.env.DB.prepare(
						[
							"SELECT account_tier AS key, COUNT(*) AS count",
							"FROM feedback_items",
							"WHERE account_tier IS NOT NULL",
							"GROUP BY account_tier",
							"ORDER BY count DESC, key ASC",
							"LIMIT 4",
						].join(" "),
					),
				),
			]);

		const themeTimeline = await c.env.DB.prepare(
			[
				"SELECT",
				"substr(created_at, 1, 10) AS bucket,",
				"SUM(CASE WHEN json_extract(metadata_json, '$.theme') = 'waf_false_positive' THEN 1 ELSE 0 END) AS waf_false_positive,",
				"SUM(CASE WHEN json_extract(metadata_json, '$.theme') = 'sso_loop' THEN 1 ELSE 0 END) AS sso_loop,",
				"SUM(CASE WHEN json_extract(metadata_json, '$.theme') = 'analytics_delay' THEN 1 ELSE 0 END) AS analytics_delay",
				"FROM feedback_items",
				"WHERE created_at >= ?",
				"GROUP BY substr(created_at, 1, 10)",
				"ORDER BY bucket ASC",
			].join(" "),
		)
			.bind(last14d)
			.all<ThemeTimelineRow>();

		return c.json({
			daily_volume: (dailyVolumeResult.results ?? [])
				.filter((row) => typeof row.key === "string")
				.map((row) => ({
					bucket: row.key as string,
					count: toCount(row.count),
				})),
			source_breakdown: sourceBreakdown,
			product_area_breakdown: productAreaBreakdown,
			tier_breakdown: tierBreakdown,
			theme_timeline: (themeTimeline.results ?? []).map((row) => ({
				bucket: row.bucket,
				waf_false_positive: toCount(row.waf_false_positive),
				sso_loop: toCount(row.sso_loop),
				analytics_delay: toCount(row.analytics_delay),
			})),
		});
	} catch (error) {
		console.error("trends query failed:", error);
		return jsonError("Failed to fetch trends.", 500, "internal_error");
	}
});

app.post("/api/analyze", async (c) => {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return jsonError("Invalid JSON body.", 400);
	}

	const request = (isRecord(body) ? body : {}) as AnalyzeRequest;
	const scope = request.scope ?? "unprocessed";
	const classify = request.steps?.classify ?? false;
	const maxItems = parseIntParam(String(request.limits?.max_items ?? ""), {
		fallback: 100,
		min: 1,
		max: 100,
	});

	if (scope !== "unprocessed") {
		return jsonError("Only scope=unprocessed is supported right now.", 400);
	}
	if (!classify) {
		return jsonError("This endpoint currently supports steps.classify=true only.", 400);
	}

	let targets: AnalyzeTargetRow[] = [];
	try {
		const result = await c.env.DB.prepare(
			[
				"SELECT id, text, metadata_json",
				"FROM feedback_items",
				"WHERE sentiment IS NULL OR urgency IS NULL",
				"ORDER BY created_at DESC",
				"LIMIT ?",
			].join(" "),
		)
			.bind(maxItems)
			.all<AnalyzeTargetRow>();
		targets = result.results ?? [];
	} catch (error) {
		console.error("analyze target query failed:", error);
		return jsonError("Failed to load items for analysis.", 500, "internal_error");
	}

	if (targets.length === 0) {
		return c.json({ processed: 0, classified: 0, verifier_used_count: 0 });
	}

	const updateStatement = c.env.DB.prepare(
		[
			"UPDATE feedback_items",
			"SET sentiment = ?, urgency = ?, processed_at = ?, metadata_json = ?",
			"WHERE id = ?",
		].join(" "),
	);

	let classified = 0;
	let verifierUsedCount = 0;
	const now = new Date().toISOString();

	for (const item of targets) {
		try {
			const classification = await classifyWithVerifierFallback(c.env, item.text);
			const metadata = parseMetadataJson(item.metadata_json);
			const nextMetadata = {
				...metadata,
				theme_family: classification.theme_family,
				theme_label: classification.theme_label,
				confidence: classification.confidence,
				model: classification.model,
				verifier_used: classification.verifier_used,
				rationale: classification.rationale,
			};

			await updateStatement
				.bind(
					classification.sentiment,
					classification.urgency,
					now,
					JSON.stringify(nextMetadata),
					item.id,
				)
				.run();

			classified += 1;
			if (classification.verifier_used) verifierUsedCount += 1;
		} catch (error) {
			console.error(`classification failed for ${item.id}:`, error);
		}
	}

	return c.json({
		processed: classified,
		classified,
		verifier_used_count: verifierUsedCount,
	});
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
			"text, sentiment, urgency, processed_at, metadata_json",
			"FROM feedback_items",
			where.length ? `WHERE ${where.join(" AND ")}` : "",
			"ORDER BY created_at DESC",
			"LIMIT ? OFFSET ?",
		]
			.filter(Boolean)
			.join(" ") + ";";

	try {
		const countSql =
			[
				"SELECT COUNT(*) AS total_count",
				"FROM feedback_items",
				where.length ? `WHERE ${where.join(" AND ")}` : "",
			]
				.filter(Boolean)
				.join(" ") + ";";

		const [results, totalRow] = await Promise.all([
			c.env.DB.prepare(sql)
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
					sentiment: Sentiment | null;
					urgency: Urgency | null;
					processed_at: string | null;
					metadata_json: string | null;
				}>(),
			c.env.DB.prepare(countSql).bind(...binds).first<TotalCountRow>(),
		]);

		const items = (results.results ?? []).map((r) => {
			const metadata = parseMetadataJson(r.metadata_json);

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
				sentiment: r.sentiment ?? undefined,
				urgency: r.urgency ?? undefined,
				processed_at: r.processed_at ?? undefined,
				metadata,
				ingested_at: r.ingested_at,
			};
			return out;
		});

		const next_offset = items.length === limit ? offset + limit : null;
		const totalCount = toCount(totalRow?.total_count);
		const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
		const currentPage = totalCount === 0 ? 0 : Math.floor(offset / limit) + 1;
		return c.json({
			items,
			next_offset,
			total_count: totalCount,
			page_size: limit,
			current_page: currentPage,
			total_pages: totalPages,
		});
	} catch (err) {
		console.error("items query failed:", err);
		return jsonError("Failed to fetch items.", 500, "internal_error");
	}
});

export default app;
