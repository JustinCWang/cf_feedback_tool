import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";

export function DigestsPage() {
	return (
		<div className="page-stack">
			<PageHeader
				eyebrow="Digests"
				title="Executive digests"
				description="Reserve space for PM summaries, spikes, and narrative briefs generated from the feedback stream."
			/>

			<SectionCard
				title="Digest workspace"
				description="The D1 schema already includes a `digests` table, so the dashboard shell can expose this feature before the generation routes exist."
			>
				<EmptyState
					title="Digests are not available yet"
					description="Future routes can populate daily and weekly summaries here without changing the overall information architecture."
				/>
			</SectionCard>
		</div>
	);
}
