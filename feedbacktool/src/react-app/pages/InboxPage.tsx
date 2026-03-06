import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FeedbackTable } from "../components/FeedbackTable";
import { FilterBar } from "../components/FilterBar";
import { LoadingRing } from "../components/LoadingRing";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { getItems, type ItemsResponse } from "../lib/api";

function toIsoBoundary(value: string, boundary: "start" | "end") {
	if (!value) return "";
	return boundary === "start"
		? `${value}T00:00:00.000Z`
		: `${value}T23:59:59.999Z`;
}

export function InboxPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const [data, setData] = useState<ItemsResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const filters = {
		source: searchParams.get("source") ?? "",
		product_area: searchParams.get("product_area") ?? "",
		account_tier: searchParams.get("account_tier") ?? "",
		from: searchParams.get("from") ?? "",
		to: searchParams.get("to") ?? "",
	};
	const offset = Number(searchParams.get("offset") ?? "0");

	useEffect(() => {
		let cancelled = false;

		async function load() {
			setLoading(true);
			setError("");
			try {
				const result = await getItems({
					limit: 12,
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
	}, [filters.account_tier, filters.from, filters.product_area, filters.source, filters.to, offset]);

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
						setSearchParams(next);
					}}
				/>
			</SectionCard>

			<SectionCard
				title="Latest feedback"
				description="Server-backed records ordered by newest feedback first."
				actions={
					<div className="pagination">
						<button
							type="button"
							className="button-secondary"
							disabled={offset === 0}
							onClick={() => {
								const next = new URLSearchParams(searchParams);
								const nextOffset = Math.max(0, offset - 12);
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
					<FeedbackTable items={data?.items ?? []} />
				)}
			</SectionCard>
		</div>
	);
}
