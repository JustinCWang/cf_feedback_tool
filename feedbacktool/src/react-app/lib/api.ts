import type { FeedbackItem } from "../../shared/types";

export type ApiErrorResponse = {
	error: {
		code: string;
		message: string;
	};
};

export type HealthResponse = {
	status: string;
	time: string;
	database?: string;
};

export type IngestResponse = {
	inserted: number;
	skipped: number;
};

export type AnalyzeResponse = {
	processed: number;
	classified: number;
	verifier_used_count: number;
};

export type ItemsResponse = {
	items: Array<FeedbackItem & { ingested_at: string }>;
	next_offset: number | null;
};

export type BreakdownDatum = {
	key: string;
	count: number;
};

export type OverviewResponse = {
	totals: {
		total_items: number;
		items_last_24h: number;
		items_last_7d: number;
		active_sources: number;
		active_product_areas: number;
		latest_ingested_at: string | null;
	};
	by_source: BreakdownDatum[];
	by_product_area: BreakdownDatum[];
	by_account_tier: BreakdownDatum[];
	top_themes: BreakdownDatum[];
};

export type TrendPoint = {
	bucket: string;
	count: number;
};

export type ThemeTimelinePoint = {
	bucket: string;
	waf_false_positive: number;
	sso_loop: number;
	analytics_delay: number;
};

export type TrendsResponse = {
	daily_volume: TrendPoint[];
	source_breakdown: BreakdownDatum[];
	product_area_breakdown: BreakdownDatum[];
	tier_breakdown: BreakdownDatum[];
	theme_timeline: ThemeTimelinePoint[];
};

async function readJson<T>(response: Response): Promise<T> {
	const data = (await response.json()) as T | ApiErrorResponse;
	if (!response.ok) {
		const message =
			"error" in (data as ApiErrorResponse)
				? (data as ApiErrorResponse).error.message
				: `Request failed with status ${response.status}.`;
		throw new Error(message);
	}
	return data as T;
}

function buildItemsSearch(params: {
	limit?: number;
	offset?: number;
	source?: string;
	product_area?: string;
	account_tier?: string;
	from?: string;
	to?: string;
}) {
	const search = new URLSearchParams();

	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== "") {
			search.set(key, String(value));
		}
	}

	return search.toString();
}

export async function getHealth(): Promise<HealthResponse> {
	return readJson<HealthResponse>(await fetch("/api/health"));
}

export async function getOverview(): Promise<OverviewResponse> {
	return readJson<OverviewResponse>(await fetch("/api/overview"));
}

export async function getTrends(): Promise<TrendsResponse> {
	return readJson<TrendsResponse>(await fetch("/api/trends"));
}

export async function getItems(params: {
	limit?: number;
	offset?: number;
	source?: string;
	product_area?: string;
	account_tier?: string;
	from?: string;
	to?: string;
}): Promise<ItemsResponse> {
	const search = buildItemsSearch(params);
	const url = search ? `/api/items?${search}` : "/api/items";
	return readJson<ItemsResponse>(await fetch(url));
}

export async function ingestItems(items: FeedbackItem[]): Promise<IngestResponse> {
	return readJson<IngestResponse>(
		await fetch("/api/ingest", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ items }),
		}),
	);
}

export async function analyzeItems(maxItems: number = 100): Promise<AnalyzeResponse> {
	return readJson<AnalyzeResponse>(
		await fetch("/api/analyze", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				scope: "unprocessed",
				steps: { classify: true },
				limits: { max_items: maxItems },
			}),
		}),
	);
}
