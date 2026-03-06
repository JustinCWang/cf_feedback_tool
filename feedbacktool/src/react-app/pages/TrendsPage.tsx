import { useEffect, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { getTrends, type TrendsResponse } from "../lib/api";
import { clampPercent, formatCount, formatLabel } from "../lib/format";

function MetricBarList({
	items,
}: {
	items: Array<{ key?: string; bucket?: string; count: number }>;
}) {
	if (items.length === 0) {
		return (
			<EmptyState
				title="No trend data yet"
				description="Ingest the staged datasets to populate trend summaries."
			/>
		);
	}

	const maxCount = Math.max(...items.map((item) => item.count), 1);

	return (
		<div className="bar-list">
			{items.map((item) => (
				<div key={item.key ?? item.bucket} className="bar-list__row">
					<div className="bar-list__copy">
						<span>{formatLabel(item.key ?? item.bucket ?? "unknown")}</span>
						<strong>{formatCount(item.count)}</strong>
					</div>
					<div className="bar-list__track">
						<div
							className="bar-list__fill"
							style={{ width: `${clampPercent(item.count, maxCount)}%` }}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

export function TrendsPage() {
	const [data, setData] = useState<TrendsResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let cancelled = false;

		async function load() {
			setLoading(true);
			setError("");
			try {
				const result = await getTrends();
				if (!cancelled) {
					setData(result);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load trends.");
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="page-stack">
			<PageHeader
				eyebrow="Trends"
				title="Trends and incident signals"
				description="Use D1-backed aggregates to understand how the storyline is moving across time, source, and product area."
			/>

			{loading ? (
				<SectionCard title="Trend snapshots" description="Loading aggregate views.">
					<p className="muted-text">Loading trends...</p>
				</SectionCard>
			) : error ? (
				<SectionCard title="Trend snapshots" description="Unable to load current aggregates.">
					<p className="error-text">{error}</p>
				</SectionCard>
			) : (
				<>
					<div className="content-grid content-grid--two">
						<SectionCard title="Daily volume" description="Recent per-day feedback volume from D1.">
							<MetricBarList items={data?.daily_volume ?? []} />
						</SectionCard>

						<SectionCard title="Theme wave timeline" description="Metadata-derived storylines across recent days.">
							<div className="timeline-table">
								<div className="timeline-table__header">
									<span>Day</span>
									<span>WAF</span>
									<span>Zero Trust</span>
									<span>Analytics</span>
								</div>
								{(data?.theme_timeline ?? []).map((item) => (
									<div key={item.bucket} className="timeline-table__row">
										<span>{item.bucket}</span>
										<strong>{formatCount(item.waf_false_positive)}</strong>
										<strong>{formatCount(item.sso_loop)}</strong>
										<strong>{formatCount(item.analytics_delay)}</strong>
									</div>
								))}
							</div>
						</SectionCard>
					</div>

					<div className="content-grid content-grid--three">
						<SectionCard title="By source" description="Which channels are lighting up first.">
							<MetricBarList items={data?.source_breakdown ?? []} />
						</SectionCard>

						<SectionCard title="By product" description="Where concentration is highest right now.">
							<MetricBarList items={data?.product_area_breakdown ?? []} />
						</SectionCard>

						<SectionCard title="By tier" description="Customer segment concentration for the current story.">
							<MetricBarList items={data?.tier_breakdown ?? []} />
						</SectionCard>
					</div>
				</>
			)}
		</div>
	);
}
