import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";

export function ThemesPage() {
	return (
		<div className="page-stack">
			<PageHeader
				eyebrow="Themes"
				title="Theme clusters"
				description="Prepare the interface for clustered incident rollups, narrative summaries, and severity-aware review."
			/>

			<SectionCard
				title="Theme rollups"
				description="The D1 schema already includes a `themes` table, but the analysis pipeline has not been implemented yet."
			>
				<EmptyState
					title="Themes will land here"
					description="Once the enrichment pipeline writes `theme_id`, sentiment, urgency, and summaries, this page can surface clustered incidents and recovery tracking."
				/>
			</SectionCard>
		</div>
	);
}
