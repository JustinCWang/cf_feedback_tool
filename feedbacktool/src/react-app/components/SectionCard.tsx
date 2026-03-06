import type { ReactNode } from "react";

type SectionCardProps = {
	title: string;
	description?: string;
	children: ReactNode;
	actions?: ReactNode;
};

export function SectionCard({
	title,
	description,
	children,
	actions,
}: SectionCardProps) {
	return (
		<section className="section-card">
			<div className="section-card__header">
				<div>
					<h2>{title}</h2>
					{description ? <p>{description}</p> : null}
				</div>
				{actions ? <div>{actions}</div> : null}
			</div>
			<div className="section-card__body">{children}</div>
		</section>
	);
}
