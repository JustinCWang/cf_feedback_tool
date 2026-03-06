import { useEffect, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { LoadingRing } from "../components/LoadingRing";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { analyzeItems, getThemes, type ThemeSummary } from "../lib/api";
import { formatCount, formatDateTime, formatLabel } from "../lib/format";

export function ThemesPage() {
	const [themes, setThemes] = useState<ThemeSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [clustering, setClustering] = useState(false);
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");

	async function refreshThemes() {
		setLoading(true);
		setError("");
		try {
			const result = await getThemes();
			setThemes(result.themes);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load themes.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		void refreshThemes();
	}, []);

	async function handleCluster() {
		setClustering(true);
		setStatus("");
		try {
			const result = await analyzeItems(150, { cluster: true });
			setStatus(
				[
					`Clustered ${result.clustered ?? 0} items.`,
					`Updated ${result.themes_updated ?? 0} themes.`,
				].join(" "),
			);
			await refreshThemes();
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Theme clustering failed.");
		} finally {
			setClustering(false);
		}
	}

	return (
		<div className="page-stack">
			<PageHeader
				eyebrow="Themes"
				title="Theme clusters"
				description="Review clustered issue groups built from Vectorize nearest-neighbor matches over indexed feedback."
				actions={
					<button type="button" onClick={handleCluster} disabled={clustering}>
						{clustering ? <LoadingRing label="Clustering themes" size="sm" /> : null}
						<span>{clustering ? "Clustering themes..." : "Cluster indexed feedback"}</span>
					</button>
				}
			/>

			<SectionCard
				title="Theme rollups"
				description="Theme clusters are persisted in D1 after the worker groups nearby embeddings with `queryById()` KNN lookups."
			>
				{status ? <p className="inline-status">{status}</p> : null}
				{loading ? (
					<div className="loading-inline">
						<LoadingRing label="Loading themes" size="sm" />
						<p className="muted-text">Loading clustered themes...</p>
					</div>
				) : error ? (
					<p className="error-text">{error}</p>
				) : themes.length === 0 ? (
					<EmptyState
						title="No clusters yet"
						description="Run theme clustering after classification and embedding to persist related-issue groups."
					/>
				) : (
					<div className="search-results__grid">
						{themes.map((theme) => (
							<article key={theme.id} className="search-result-card">
								<div className="search-result-card__header">
									<div className="feedback-table__badges">
										{theme.sentiment ? (
											<span
												className={`table-badge table-badge--sentiment-${theme.sentiment}`}
											>
												{formatLabel(theme.sentiment)}
											</span>
										) : null}
										{theme.urgency ? (
											<span
												className={`table-badge table-badge--urgency-${theme.urgency}`}
											>
												{formatLabel(theme.urgency)}
											</span>
										) : null}
									</div>
									<strong className="search-result-card__score">
										{formatCount(theme.item_count)} items
									</strong>
								</div>
								<h3 className="theme-card__title">{theme.name}</h3>
								<p className="search-result-card__text">
									{theme.summary ?? "No summary available yet."}
								</p>
								<div className="metric-list">
									<div className="metric-list__row">
										<span>Last 24h</span>
										<strong>{formatCount(theme.volume_24h)}</strong>
									</div>
									<div className="metric-list__row">
										<span>Last 7d</span>
										<strong>{formatCount(theme.volume_7d)}</strong>
									</div>
								</div>
								<div className="search-result-card__meta">
									<span>Updated {formatDateTime(theme.updated_at)}</span>
									{theme.last_seen_at ? (
										<span>Latest signal {formatDateTime(theme.last_seen_at)}</span>
									) : null}
								</div>
							</article>
						))}
					</div>
				)}
			</SectionCard>
		</div>
	);
}
