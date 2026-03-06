import { formatDateTime } from "../lib/format";

type TopBarProps = {
	healthStatus: "loading" | "healthy" | "error";
	lastChecked?: string;
};

export function TopBar({ healthStatus, lastChecked }: TopBarProps) {
	const label =
		healthStatus === "healthy"
			? "D1 connected"
			: healthStatus === "error"
				? "Service issue"
				: "Checking health";

	return (
		<div className="topbar">
			<div>
				<p className="topbar__eyebrow">Product feedback operations</p>
				<p className="topbar__title">Professional dashboard shell for ingest, inbox, and trend review</p>
			</div>

			<div className={`status-pill status-pill--${healthStatus}`}>
				<span className="status-pill__dot" />
				<span>{label}</span>
				{lastChecked ? <span className="status-pill__time">{formatDateTime(lastChecked)}</span> : null}
			</div>
		</div>
	);
}
