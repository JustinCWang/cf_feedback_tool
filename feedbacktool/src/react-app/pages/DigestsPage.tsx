import { useEffect, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { LoadingRing } from "../components/LoadingRing";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import {
	generateDigest,
	getDigests,
	type DigestSummary,
	type GenerateDigestResponse,
} from "../lib/api";
import { formatCount, formatDateTime, formatLabel } from "../lib/format";

export function DigestsPage() {
	const [digests, setDigests] = useState<DigestSummary[]>([]);
	const [latestGenerated, setLatestGenerated] =
		useState<GenerateDigestResponse["digest"] | null>(null);
	const [loading, setLoading] = useState(true);
	const [generating, setGenerating] = useState(false);
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");

	async function refreshDigests() {
		setLoading(true);
		setError("");
		try {
			const result = await getDigests();
			setDigests(result.digests);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load digests.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		void refreshDigests();
	}, []);

	async function handleGenerateDigest(windowHours: number) {
		setGenerating(true);
		setStatus("");
		setError("");
		try {
			const result = await generateDigest(windowHours);
			setLatestGenerated(result.digest);
			setStatus(
				`Generated a ${windowHours}-hour digest covering ${formatCount(result.digest.top_themes.reduce((sum, theme) => sum + theme.volume, 0))} clustered theme signals.`,
			);
			await refreshDigests();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Digest generation failed.");
		} finally {
			setGenerating(false);
		}
	}

	return (
		<div className="page-stack">
			<PageHeader
				eyebrow="Digests"
				title="Executive digests"
				description="Generate PM-ready narrative summaries from the analyzed feedback stream and keep a history of what changed."
				actions={
					<div className="action-stack">
						<button
							type="button"
							onClick={() => handleGenerateDigest(24)}
							disabled={generating}
						>
							{generating ? <LoadingRing label="Generating digest" size="sm" /> : null}
							<span>{generating ? "Generating digest..." : "Generate 24h digest"}</span>
						</button>
						<button
							type="button"
							className="button-secondary"
							onClick={() => handleGenerateDigest(168)}
							disabled={generating}
						>
							<span>Generate 7d digest</span>
						</button>
					</div>
				}
			/>

			<SectionCard
				title="Digest generator"
				description="Workers AI turns your clustered feedback into a short PM update and stores it in D1."
			>
				{status ? <p className="inline-status">{status}</p> : null}
				{error ? <p className="error-text">{error}</p> : null}

				{latestGenerated ? (
					<div className="search-results">
						<div className="search-results__summary">
							<strong>Latest generated digest</strong>
							<p className="search-results__summary-text">{latestGenerated.text}</p>
							<div className="search-result-card__meta">
								<span>Generated {formatDateTime(latestGenerated.created_at)}</span>
								<span>
									Window {formatDateTime(latestGenerated.window_start)} to{" "}
									{formatDateTime(latestGenerated.window_end)}
								</span>
							</div>
						</div>
						<div className="content-grid content-grid--two">
							<SectionCard
								title="Top themes in this digest"
								description="The strongest analyzed issue groups included in the summary."
							>
								{latestGenerated.top_themes.length === 0 ? (
									<p className="muted-text">No clustered themes were available in that window.</p>
								) : (
									<div className="metric-list">
										{latestGenerated.top_themes.map((theme) => (
											<div key={theme.name} className="metric-list__row">
												<span>
													{theme.urgency ? `${formatLabel(theme.urgency)}: ` : ""}
													{theme.name}
												</span>
												<strong>{formatCount(theme.volume)}</strong>
											</div>
										))}
									</div>
								)}
							</SectionCard>
							<SectionCard
								title="Source distribution"
								description="Where the feedback in this digest is coming from."
							>
								<div className="metric-list">
									{latestGenerated.top_sources.map((source) => (
										<div key={source.key} className="metric-list__row">
											<span>{formatLabel(source.key)}</span>
											<strong>{formatCount(source.count)}</strong>
										</div>
									))}
								</div>
							</SectionCard>
						</div>
					</div>
				) : (
					<p className="muted-text">
						Generate a digest to capture the current state of analyzed feedback.
					</p>
				)}
			</SectionCard>

			<SectionCard
				title="Digest history"
				description="Recent PM digests stored in D1."
			>
				{loading ? (
					<div className="loading-inline">
						<LoadingRing label="Loading digests" size="sm" />
						<p className="muted-text">Loading digest history...</p>
					</div>
				) : digests.length === 0 ? (
					<EmptyState
						title="No digests yet"
						description="Generate your first digest once the analysis pipeline has produced useful theme signals."
					/>
				) : (
					<div className="search-results">
						{digests.map((digest) => (
							<article key={digest.id} className="search-results__summary">
								<div className="search-result-card__meta">
									<strong>{formatDateTime(digest.created_at)}</strong>
									<span>
										Window {formatDateTime(digest.window_start)} to{" "}
										{formatDateTime(digest.window_end)}
									</span>
								</div>
								<p className="search-results__summary-text">{digest.text}</p>
							</article>
						))}
					</div>
				)}
			</SectionCard>
		</div>
	);
}
