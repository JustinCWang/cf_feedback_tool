import { useState } from "react";
import "./App.css";
import type { FeedbackItem } from "../shared/types";

type DatasetKind = "seed" | "stream" | "followup" | "all";
type IngestResponse = { inserted: number; skipped: number };
type ItemsResponse = {
	items: Array<FeedbackItem & { ingested_at: string }>;
	next_offset: number | null;
};
type ErrorResponse = { error: { code: string; message: string } };

const DATASET_LABELS: Record<DatasetKind, string> = {
	seed: "baseline",
	stream: "last 24h",
	followup: "escalation wave",
	all: "full story",
};

const DATASET_FILES: Record<Exclude<DatasetKind, "all">, string> = {
	seed: "/data/seed.json",
	stream: "/data/stream.json",
	followup: "/data/followup.json",
};

async function fetchDataset(kind: DatasetKind): Promise<FeedbackItem[]> {
	if (kind === "all") {
		const datasets = await Promise.all([
			fetchDataset("seed"),
			fetchDataset("stream"),
			fetchDataset("followup"),
		]);
		return datasets.flat();
	}

	const dataRes = await fetch(DATASET_FILES[kind]);
	if (!dataRes.ok) {
		throw new Error(`Failed to fetch ${kind} dataset (${dataRes.status}).`);
	}

	const items = (await dataRes.json()) as unknown;
	if (!Array.isArray(items)) {
		throw new Error(`${kind} dataset JSON is not an array.`);
	}

	return items as FeedbackItem[];
}

function App() {
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState("");
	const [preview, setPreview] = useState<Array<FeedbackItem & { ingested_at: string }>>(
		[],
	);

	async function loadDataset(kind: DatasetKind) {
		setBusy(true);
		setStatus("");
		setPreview([]);

		try {
			const items = await fetchDataset(kind);

			const ingestRes = await fetch("/api/ingest", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ items }),
			});
			const ingestJson = (await ingestRes.json()) as IngestResponse | ErrorResponse;
			if (!ingestRes.ok) {
				throw new Error(
					"error" in ingestJson
						? ingestJson.error.message
						: `Ingest failed (${ingestRes.status}).`,
				);
			}
			if ("error" in ingestJson) {
				throw new Error(ingestJson.error.message);
			}

			const itemsRes = await fetch("/api/items?limit=10");
			if (!itemsRes.ok) {
				throw new Error(`Failed to fetch items (${itemsRes.status}).`);
			}

			const itemsJson = (await itemsRes.json()) as ItemsResponse;
			setStatus(
				`Loaded ${DATASET_LABELS[kind]}: inserted ${ingestJson.inserted}, skipped ${ingestJson.skipped}, total sent ${items.length}.`,
			);
			setPreview(itemsJson.items ?? []);
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="app">
			<header className="header">
				<h1>Feedback Inbox Prototype</h1>
				<p className="sub">
					Load staged mock feedback into D1, then review the latest items from
					<code> /api/items</code>.
				</p>
			</header>

			<section className="card">
				<h2>Mock data storyline</h2>
				<p className="muted">
					Use the baseline, recent spike, and escalation wave datasets to tell a
					clear story about trend changes over time.
				</p>
				<div className="row">
					<button onClick={() => loadDataset("seed")} disabled={busy}>
						Load baseline
					</button>
					<button onClick={() => loadDataset("stream")} disabled={busy}>
						Load last 24h
					</button>
					<button onClick={() => loadDataset("followup")} disabled={busy}>
						Load escalation wave
					</button>
					<button onClick={() => loadDataset("all")} disabled={busy}>
						Load full story
					</button>
				</div>

				{status ? <p className="status">{status}</p> : null}
			</section>

			<section className="card">
				<h2>Latest items</h2>
				{preview.length === 0 ? (
					<p className="muted">
						Load a dataset to preview the latest 10 ingested items.
					</p>
				) : (
					<ul className="items">
						{preview.map((it) => (
							<li key={it.id} className="item">
								<div className="itemTop">
									<span className="badge">{it.source}</span>
									<span className="meta">
										{it.product_area ?? "unknown"} · {it.account_tier ?? "unknown"}{" "}
										· <code>{it.created_at}</code>
									</span>
								</div>
								<p className="text">{it.text}</p>
								<div className="itemBottom">
									<span className="muted">
										{it.location_region ?? "?"}/{it.location_country ?? "?"}
										{it.location_colo ? ` · ${it.location_colo}` : ""}
									</span>
									{it.url ? (
										<a href={it.url} target="_blank" rel="noreferrer">
											Open source
										</a>
									) : null}
								</div>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}

export default App;
