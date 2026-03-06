export function formatLabel(value: string) {
	return value
		.replace(/_/g, " ")
		.replace(/\b\w/g, (match: string) => match.toUpperCase());
}

export function formatCount(value: number) {
	return new Intl.NumberFormat("en-US").format(value);
}

export function formatDateTime(value: string | null | undefined) {
	if (!value) return "N/A";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}

export function clampPercent(value: number, max: number) {
	if (max <= 0) return 0;
	return Math.max(6, Math.round((value / max) * 100));
}
