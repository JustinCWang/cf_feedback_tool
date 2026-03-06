import type { FeedbackItem } from "../../shared/types";

export type DatasetKind = "seed" | "stream" | "followup" | "all";

export const DATASET_OPTIONS: Array<{
	kind: DatasetKind;
	label: string;
	description: string;
}> = [
	{
		kind: "seed",
		label: "Load baseline",
		description: "Broad baseline signals across product areas.",
	},
	{
		kind: "stream",
		label: "Load last 24h",
		description: "Recent spike across WAF, Zero Trust, and Analytics.",
	},
	{
		kind: "followup",
		label: "Load escalation wave",
		description: "Follow-up asks, recovery signals, and operational friction.",
	},
	{
		kind: "all",
		label: "Load full story",
		description: "Seed all staged datasets into D1 in one pass.",
	},
];

const DATASET_FILES: Record<Exclude<DatasetKind, "all">, string> = {
	seed: "/data/seed.json",
	stream: "/data/stream.json",
	followup: "/data/followup.json",
};

async function loadSingleDataset(
	kind: Exclude<DatasetKind, "all">,
): Promise<FeedbackItem[]> {
	const response = await fetch(DATASET_FILES[kind]);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${kind} dataset (${response.status}).`);
	}

	const data = (await response.json()) as unknown;
	if (!Array.isArray(data)) {
		throw new Error(`${kind} dataset JSON is not an array.`);
	}

	return data as FeedbackItem[];
}

export async function loadDataset(kind: DatasetKind): Promise<FeedbackItem[]> {
	if (kind === "all") {
		const results = await Promise.all([
			loadSingleDataset("seed"),
			loadSingleDataset("stream"),
			loadSingleDataset("followup"),
		]);
		return results.flat();
	}

	return loadSingleDataset(kind);
}
