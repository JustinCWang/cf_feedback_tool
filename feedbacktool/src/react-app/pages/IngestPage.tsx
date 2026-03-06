import { useState } from "react";
import { DatasetActions } from "../components/DatasetActions";
import { FeedbackTable } from "../components/FeedbackTable";
import { LoadingRing } from "../components/LoadingRing";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { analyzeItems, getItems, ingestItems } from "../lib/api";
import { loadDataset, type DatasetKind } from "../lib/mock-data";

export function IngestPage() {
	const [busy, setBusy] = useState(false);
	const [analyzing, setAnalyzing] = useState(false);
	const [status, setStatus] = useState("");
	const [preview, setPreview] = useState<Array<
		Awaited<ReturnType<typeof getItems>>["items"][number]
	>>([]);

	async function handleDatasetRun(kind: DatasetKind) {
		setBusy(true);
		setStatus("");
		try {
			const items = await loadDataset(kind);
			const result = await ingestItems(items);
			const latest = await getItems({ limit: 8, offset: 0 });
			setPreview(latest.items);
			setStatus(
				`Loaded ${kind}: inserted ${result.inserted}, skipped ${result.skipped}, total sent ${items.length}.`,
			);
		} catch (error) {
			setStatus(error instanceof Error ? error.message : "Ingest failed.");
		} finally {
			setBusy(false);
		}
	}

	async function handleAnalyze() {
		setAnalyzing(true);
		setStatus("");
		try {
			const result = await analyzeItems(100);
			const latest = await getItems({ limit: 8, offset: 0 });
			setPreview(latest.items);
			setStatus(
				[
					`Analyzed ${result.classified} items.`,
					`Updated ${result.processed} rows.`,
					`Verifier used ${result.verifier_used_count} times.`,
				].join(" "),
			);
		} catch (error) {
			setStatus(error instanceof Error ? error.message : "Analysis failed.");
		} finally {
			setAnalyzing(false);
		}
	}

	return (
		<div className="page-stack">
			<PageHeader
				eyebrow="Ingest"
				title="Mock data ingestion"
				description="Seed D1 with staged mock datasets locally or against your deployed Worker and verify the latest records immediately."
			/>

			<div className="content-grid content-grid--two">
				<SectionCard
					title="Dataset controls"
					description="Use staged data to tell a story with baseline, spike, and follow-up waves."
				>
					<DatasetActions busy={busy} onRun={handleDatasetRun} />
					{status ? <p className="inline-status">{status}</p> : null}
				</SectionCard>

				<SectionCard
					title="AI classification"
					description="Run Workers AI sentiment, urgency, and theme labeling on the newest unprocessed feedback."
				>
					<div className="action-stack">
						<button type="button" onClick={handleAnalyze} disabled={busy || analyzing}>
							{analyzing ? <LoadingRing label="Analyzing feedback" size="sm" /> : null}
							<span>{analyzing ? "Analyzing feedback..." : "Analyze unprocessed items"}</span>
						</button>
						<p className="muted-text">
							Uses JSON Mode with an 8B primary model and a stronger verifier when
							confidence is low or guardrails are violated.
						</p>
					</div>
				</SectionCard>
			</div>

			<SectionCard
				title="Remote D1 workflow"
				description="After deploy, seed the remote Worker URL instead of the local dev server."
			>
				<div className="code-note">
					<code>npm run db:migrate:remote</code>
					<code>npm run deploy</code>
					<code>
						node ./scripts/ingest-mock-data.mjs --dataset all --url
						https://&lt;your-worker&gt;.workers.dev
					</code>
				</div>
			</SectionCard>

			<SectionCard
				title="Latest ingested items"
				description="Quick verification view after each seed or analysis action."
			>
				<FeedbackTable items={preview} />
			</SectionCard>
		</div>
	);
}
