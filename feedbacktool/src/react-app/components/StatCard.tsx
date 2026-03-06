type StatCardProps = {
	label: string;
	value: string;
	helper?: string;
	tone?: "default" | "accent";
};

export function StatCard({
	label,
	value,
	helper,
	tone = "default",
}: StatCardProps) {
	return (
		<div className={`stat-card stat-card--${tone}`}>
			<p className="stat-card__label">{label}</p>
			<p className="stat-card__value">{value}</p>
			{helper ? <p className="stat-card__helper">{helper}</p> : null}
		</div>
	);
}
