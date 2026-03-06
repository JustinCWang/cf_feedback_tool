import type { DatasetKind } from "../lib/mock-data";
import { DATASET_OPTIONS } from "../lib/mock-data";
import { LoadingRing } from "./LoadingRing";

type DatasetActionsProps = {
	busy: boolean;
	activeKind?: DatasetKind | null;
	onRun: (kind: DatasetKind) => void;
	compact?: boolean;
};

export function DatasetActions({
	busy,
	activeKind = null,
	onRun,
	compact = false,
}: DatasetActionsProps) {
	return (
		<div className={compact ? "dataset-grid dataset-grid--compact" : "dataset-grid"}>
			{DATASET_OPTIONS.map((dataset) => (
				<button
					key={dataset.kind}
					type="button"
					className="dataset-action"
					onClick={() => onRun(dataset.kind)}
					disabled={busy}
				>
					<span className="dataset-action__title">
						{activeKind === dataset.kind ? (
							<>
								<LoadingRing label={`Loading ${dataset.label}`} size="sm" />
								<span>{dataset.label}</span>
							</>
						) : (
							dataset.label
						)}
					</span>
					<span className="dataset-action__description">{dataset.description}</span>
				</button>
			))}
		</div>
	);
}
