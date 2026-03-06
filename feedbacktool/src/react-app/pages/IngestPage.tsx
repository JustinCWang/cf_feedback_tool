import { useState } from "react";
import { DatasetActions } from "../components/DatasetActions";
import { FeedbackTable } from "../components/FeedbackTable";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { getItems, ingestItems } from "../lib/api";
import { loadDataset, type DatasetKind } from "../lib/mock-data";

export function IngestPage() {
	const [busy, setBusy] = useState(false);
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
			</div>

			<SectionCard
				title="Latest ingested items"
				description="Quick verification view after each seed action."
			>
				<FeedbackTable items={preview} />
			</SectionCard>
		</div>
	);
}
