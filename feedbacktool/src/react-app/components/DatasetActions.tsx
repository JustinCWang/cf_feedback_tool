import type { DatasetKind } from "../lib/mock-data";
import { DATASET_OPTIONS } from "../lib/mock-data";

type DatasetActionsProps = {
	busy: boolean;
	onRun: (kind: DatasetKind) => void;
	compact?: boolean;
};

export function DatasetActions({
	busy,
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
					<span className="dataset-action__title">{dataset.label}</span>
					<span className="dataset-action__description">{dataset.description}</span>
				</button>
			))}
		</div>
	);
}
