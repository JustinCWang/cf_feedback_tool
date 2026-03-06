export type FeedbackSource =
	| "support"
	| "github"
	| "discord"
	| "email"
	| "twitter"
	| "forum";

export type AccountTier = "free" | "pro" | "business" | "enterprise";

export type ProductArea =
	| "workers"
	| "zero_trust"
	| "waf"
	| "dns"
	| "analytics"
	| "billing"
	| "dashboard"
	| "vectorize"
	| "d1";

export type Region = "NA" | "EU" | "APAC" | "LATAM";

/**
 * Mock payload type used for ingest (no AI/computed fields).
 * Matches D1 columns the ingest pipeline writes.
 */
export interface FeedbackItem {
	id: string;
	source: FeedbackSource;
	created_at: string;
	text: string;

	source_ref?: string;
	url?: string;
	author?: string;
	account_tier?: AccountTier;
	product_area?: ProductArea;

	location_region?: Region;
	location_country?: string;
	location_colo?: string;

	metadata?: Record<string, unknown>;
}
