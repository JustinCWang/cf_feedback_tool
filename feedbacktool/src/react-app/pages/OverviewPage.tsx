import { useEffect, useState } from "react";
import { DatasetActions } from "../components/DatasetActions";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { getOverview, ingestItems, type OverviewResponse } from "../lib/api";
import { formatCount, formatDateTime, formatLabel } from "../lib/format";
import { loadDataset, type DatasetKind } from "../lib/mock-data";

export function OverviewPage() {
	const [data, setData] = useState<OverviewResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [activeDataset, setActiveDataset] = useState<DatasetKind | null>(null);
	const [status, setStatus] = useState("");

	async function refreshOverview() {
		setLoading(true);
		try {
			setData(await getOverview());
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		void refreshOverview();
	}, []);

	async function handleDatasetRun(kind: DatasetKind) {
		setBusy(true);
		setActiveDataset(kind);
		setStatus("");
		try {
			const items = await loadDataset(kind);
			const result = await ingestItems(items);
			setStatus(
				`Loaded ${kind}: inserted ${result.inserted}, skipped ${result.skipped}.`,
			);
			await refreshOverview();
		} catch (error) {
			setStatus(error instanceof Error ? error.message : "Ingest failed.");
		} finally {
			setActiveDataset(null);
			setBusy(false);
		}
	}

	return (
		<div className="page-stack">
			<PageHeader
				eyebrow="Overview"
				title="Feedback command center"
				description="Monitor recent feedback volume, top product areas, and the storylines emerging from your staged datasets."
			/>

			{loading || !data ? (
				<SectionCard title="Overview metrics" description="Loading D1-backed summary data.">
					<p className="muted-text">Loading dashboard data...</p>
				</SectionCard>
			) : (
				<>
					<section className="stat-grid">
						<StatCard
							label="Total feedback items"
							value={formatCount(data.totals.total_items)}
							helper={`Latest ingest ${formatDateTime(data.totals.latest_ingested_at)}`}
							tone="accent"
						/>
						<StatCard
							label="Last 24 hours"
							value={formatCount(data.totals.items_last_24h)}
							helper="Recent volume window"
						/>
						<StatCard
							label="Last 7 days"
							value={formatCount(data.totals.items_last_7d)}
							helper="Weekly activity snapshot"
						/>
						<StatCard
							label="Active products"
							value={formatCount(data.totals.active_product_areas)}
							helper={`${formatCount(data.totals.active_sources)} active sources`}
						/>
					</section>

					<div className="content-grid content-grid--two">
						<SectionCard
							title="Quick ingest actions"
							description="Seed the baseline story, the incident spike, or the full storyline directly into D1."
						>
							<DatasetActions
								busy={busy}
								activeKind={activeDataset}
								onRun={handleDatasetRun}
								compact
							/>
							{status ? <p className="inline-status">{status}</p> : null}
						</SectionCard>

						<SectionCard
							title="Active storylines"
							description="Themes inferred from the seeded metadata in recent records."
						>
							{data.top_themes.length === 0 ? (
								<EmptyState
									title="No theme signals yet"
									description="Ingest mock data to surface WAF, Zero Trust, and Analytics storylines."
								/>
							) : (
								<div className="metric-list">
									{data.top_themes.map((item) => (
										<div key={item.key} className="metric-list__row">
											<span>{formatLabel(item.key)}</span>
											<strong>{formatCount(item.count)}</strong>
										</div>
									))}
								</div>
							)}
						</SectionCard>
					</div>

					<div className="content-grid content-grid--two">
						<SectionCard
							title="Volume by product area"
							description="Use this to see where concentration is rising first."
						>
							<div className="metric-list">
								{data.by_product_area.map((item) => (
									<div key={item.key} className="metric-list__row">
										<span>{formatLabel(item.key)}</span>
										<strong>{formatCount(item.count)}</strong>
									</div>
								))}
							</div>
						</SectionCard>

						<SectionCard
							title="Source and tier mix"
							description="Cross-channel and customer-tier spread for the current dataset."
						>
							<div className="split-list">
								<div className="metric-list">
									{data.by_source.map((item) => (
										<div key={item.key} className="metric-list__row">
											<span>{formatLabel(item.key)}</span>
											<strong>{formatCount(item.count)}</strong>
										</div>
									))}
								</div>
								<div className="metric-list">
									{data.by_account_tier.map((item) => (
										<div key={item.key} className="metric-list__row">
											<span>{formatLabel(item.key)}</span>
											<strong>{formatCount(item.count)}</strong>
										</div>
									))}
								</div>
							</div>
						</SectionCard>
					</div>
				</>
			)}
		</div>
	);
}
