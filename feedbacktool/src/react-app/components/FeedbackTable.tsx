import type { FeedbackItem } from "../../shared/types";
import { formatDateTime, formatLabel } from "../lib/format";
import { EmptyState } from "./EmptyState";

type FeedbackTableProps = {
	items: Array<FeedbackItem & { ingested_at: string }>;
};

export function FeedbackTable({ items }: FeedbackTableProps) {
	if (items.length === 0) {
		return (
			<EmptyState
				title="No feedback items"
				description="Change the filters or ingest a dataset to populate the inbox."
			/>
		);
	}

	return (
		<div className="table-shell">
			<table className="feedback-table">
				<thead>
					<tr>
						<th>Feedback</th>
						<th>Product</th>
						<th>Tier</th>
						<th>Source</th>
						<th>Location</th>
						<th>Created</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<tr key={item.id}>
							<td>
								<div className="feedback-table__primary">
									<p>{item.text}</p>
									<div className="feedback-table__meta">
										<span>{item.author ?? "Unknown author"}</span>
										{item.url ? (
											<a href={item.url} target="_blank" rel="noreferrer">
												Source link
											</a>
										) : null}
									</div>
								</div>
							</td>
							<td>{item.product_area ? formatLabel(item.product_area) : "Unknown"}</td>
							<td>{item.account_tier ? formatLabel(item.account_tier) : "Unknown"}</td>
							<td>
								<span className="table-badge">
									{item.source ? formatLabel(item.source) : "Unknown"}
								</span>
							</td>
							<td>
								{item.location_region ?? "?"}/{item.location_country ?? "?"}
								{item.location_colo ? ` · ${item.location_colo}` : ""}
							</td>
							<td>{formatDateTime(item.created_at)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
