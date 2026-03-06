import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { FeedbackTable } from "../components/FeedbackTable";
import { FilterBar } from "../components/FilterBar";
import { LoadingRing } from "../components/LoadingRing";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import {
	getItems,
	searchItems,
	type ItemsResponse,
	type SearchResponse,
} from "../lib/api";
import { formatDateTime, formatLabel } from "../lib/format";

function toIsoBoundary(value: string, boundary: "start" | "end") {
	if (!value) return "";
	return boundary === "start"
		? `${value}T00:00:00.000Z`
		: `${value}T23:59:59.999Z`;
}

export function InboxPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const [data, setData] = useState<ItemsResponse | null>(null);
	const [semanticData, setSemanticData] = useState<SearchResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [searchLoading, setSearchLoading] = useState(false);
	const [error, setError] = useState("");
	const [searchError, setSearchError] = useState("");
	const pageSize = 12;
	const semanticQuery = searchParams.get("q") ?? "";
	const [draftQuery, setDraftQuery] = useState(semanticQuery);

	const filters = {
		source: searchParams.get("source") ?? "",
		product_area: searchParams.get("product_area") ?? "",
		account_tier: searchParams.get("account_tier") ?? "",
		from: searchParams.get("from") ?? "",
		to: searchParams.get("to") ?? "",
	};
	const offset = Number(searchParams.get("offset") ?? "0");

	useEffect(() => {
		setDraftQuery(semanticQuery);
	}, [semanticQuery]);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			setLoading(true);
			setError("");
			try {
				const result = await getItems({
					limit: pageSize,
					offset,
					source: filters.source || undefined,
					product_area: filters.product_area || undefined,
					account_tier: filters.account_tier || undefined,
					from: filters.from ? toIsoBoundary(filters.from, "start") : undefined,
					to: filters.to ? toIsoBoundary(filters.to, "end") : undefined,
				});
				if (!cancelled) {
					setData(result);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load inbox.");
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
	}, [filters.account_tier, filters.from, filters.product_area, filters.source, filters.to, offset, pageSize]);

	useEffect(() => {
		if (!semanticQuery) {
			setSemanticData(null);
			setSearchError("");
			setSearchLoading(false);
			return;
		}

		let cancelled = false;

		async function loadSemanticSearch() {
			setSearchLoading(true);
			setSearchError("");
			try {
				const result = await searchItems({
					q: semanticQuery,
					k: 6,
					source: filters.source || undefined,
					product_area: filters.product_area || undefined,
					account_tier: filters.account_tier || undefined,
					from: filters.from ? toIsoBoundary(filters.from, "start") : undefined,
					to: filters.to ? toIsoBoundary(filters.to, "end") : undefined,
				});
				if (!cancelled) {
					setSemanticData(result);
				}
			} catch (err) {
				if (!cancelled) {
					setSearchError(
						err instanceof Error ? err.message : "Failed to run semantic search.",
					);
				}
			} finally {
				if (!cancelled) {
					setSearchLoading(false);
				}
			}
		}

		void loadSemanticSearch();
		return () => {
			cancelled = true;
		};
	}, [filters.account_tier, filters.from, filters.product_area, filters.source, filters.to, semanticQuery]);

	return (
		<div className="page-stack">
			<PageHeader
				eyebrow="Inbox"
				title="Feedback inbox"
				description="Browse and filter the raw evidence stream using the current D1-backed list endpoint."
			/>

			<SectionCard
				title="Filters"
				description="Keep filters URL-driven so this page is easy to share and extend."
			>
				<FilterBar
					initialValues={filters}
					onApply={(nextFilters) => {
						const next = new URLSearchParams();
						for (const [key, value] of Object.entries(nextFilters)) {
							if (value) next.set(key, value);
						}
						if (semanticQuery) next.set("q", semanticQuery);
						setSearchParams(next);
					}}
				/>
			</SectionCard>

			<SectionCard
				title="Semantic search"
				description="Search for similar issues across classified feedback and get a short AI summary with citations."
			>
				<form
					className="search-form"
					onSubmit={(event) => {
						event.preventDefault();
						const next = new URLSearchParams(searchParams);
						next.delete("offset");
						if (draftQuery.trim()) {
							next.set("q", draftQuery.trim());
						} else {
							next.delete("q");
						}
						setSearchParams(next);
					}}
				>
					<input
						type="text"
						value={draftQuery}
						onChange={(event) => setDraftQuery(event.target.value)}
						placeholder="Try “checkout blocked by WAF” or “login redirect loop”"
					/>
					<button type="submit" disabled={searchLoading}>
						{searchLoading ? <LoadingRing label="Running semantic search" size="sm" /> : null}
						<span>{searchLoading ? "Searching..." : "Search issues"}</span>
					</button>
					<button
						type="button"
						className="button-secondary"
						disabled={!semanticQuery && !draftQuery}
						onClick={() => {
							setDraftQuery("");
							const next = new URLSearchParams(searchParams);
							next.delete("q");
							setSearchParams(next);
						}}
					>
						Clear
					</button>
				</form>

				{!semanticQuery ? (
					<p className="muted-text">
						Run a semantic query to surface related issues across the feedback corpus.
					</p>
				) : searchLoading ? (
					<div className="loading-inline">
						<LoadingRing label="Loading semantic search results" size="sm" />
						<p className="muted-text">Searching similar issues...</p>
					</div>
				) : searchError ? (
					<p className="error-text">{searchError}</p>
				) : semanticData && semanticData.results.length === 0 ? (
					<EmptyState
						title="No related issues found"
						description="Try a broader query or relax the current filters."
					/>
				) : semanticData ? (
					<div className="search-results">
						<div className="search-results__summary">
							<div className="feedback-table__badges">
								<span className="table-badge table-badge--theme">
									{semanticData.mode === "semantic"
										? "Vectorize semantic search"
										: "D1 text fallback"}
								</span>
								{semanticData.answer?.citations.length ? (
									<span className="muted-text">
										Citations: {semanticData.answer.citations.join(", ")}
									</span>
								) : null}
							</div>
							<p className="search-results__summary-text">
								{semanticData.answer?.summary ??
									"No summary available for this search yet."}
							</p>
						</div>

						<div className="search-results__grid">
							{semanticData.results.map((result) => {
								const themeLabel =
									typeof result.metadata?.theme_label === "string"
										? result.metadata.theme_label
										: null;

								return (
									<article key={result.id} className="search-result-card">
										<div className="search-result-card__header">
											<div className="feedback-table__badges">
												<span className="table-badge">
													{formatLabel(result.source)}
												</span>
												{result.sentiment ? (
													<span
														className={`table-badge table-badge--sentiment-${result.sentiment}`}
													>
														{formatLabel(result.sentiment)}
													</span>
												) : null}
												{result.urgency ? (
													<span
														className={`table-badge table-badge--urgency-${result.urgency}`}
													>
														{formatLabel(result.urgency)}
													</span>
												) : null}
												{themeLabel ? (
													<span className="table-badge table-badge--theme">
														{themeLabel}
													</span>
												) : null}
											</div>
											{typeof result.score === "number" ? (
												<strong className="search-result-card__score">
													{result.score.toFixed(3)}
												</strong>
											) : (
												<span className="muted-text">Fallback</span>
											)}
										</div>
										<p className="search-result-card__text">{result.text}</p>
										<div className="search-result-card__meta">
											<span>{result.author ?? "Unknown author"}</span>
											<span>{formatDateTime(result.created_at)}</span>
											{result.product_area ? (
												<span>{formatLabel(result.product_area)}</span>
											) : null}
											{result.url ? (
												<a href={result.url} target="_blank" rel="noreferrer">
													Source link
												</a>
											) : null}
										</div>
									</article>
								);
							})}
						</div>
					</div>
				) : null}
			</SectionCard>

			<SectionCard
				title="Latest feedback"
				description="Server-backed records ordered by newest feedback first."
				actions={
					<div className="pagination">
						<span className="pagination__summary">
							{loading
								? "Loading pages..."
								: `Page ${data?.current_page ?? 0} of ${data?.total_pages ?? 0}`}
						</span>
						<button
							type="button"
							className="button-secondary"
							disabled={offset === 0}
							onClick={() => {
								const next = new URLSearchParams(searchParams);
								const nextOffset = Math.max(0, offset - pageSize);
								if (nextOffset === 0) {
									next.delete("offset");
								} else {
									next.set("offset", String(nextOffset));
								}
								setSearchParams(next);
							}}
						>
							Previous
						</button>
						<button
							type="button"
							disabled={!data?.next_offset}
							onClick={() => {
								if (!data?.next_offset) return;
								const next = new URLSearchParams(searchParams);
								next.set("offset", String(data.next_offset));
								setSearchParams(next);
							}}
						>
							Next
						</button>
					</div>
				}
			>
				{loading ? (
					<div className="loading-inline">
						<LoadingRing label="Loading inbox items" size="sm" />
						<p className="muted-text">Loading inbox items...</p>
					</div>
				) : error ? (
					<p className="error-text">{error}</p>
				) : (
					<>
						<p className="muted-text">
							Showing {data?.items.length ?? 0} of {data?.total_count ?? 0} matching
							items.
						</p>
						<FeedbackTable items={data?.items ?? []} />
					</>
				)}
			</SectionCard>
		</div>
	);
}
