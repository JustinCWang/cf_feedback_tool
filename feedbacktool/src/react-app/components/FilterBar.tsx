import { useState } from "react";

type FilterValues = {
	source: string;
	product_area: string;
	account_tier: string;
	from: string;
	to: string;
};

type FilterBarProps = {
	initialValues: FilterValues;
	onApply: (values: FilterValues) => void;
};

const SOURCES = ["", "support", "github", "discord", "email", "twitter", "forum"];
const PRODUCT_AREAS = [
	"",
	"workers",
	"zero_trust",
	"waf",
	"dns",
	"analytics",
	"billing",
	"dashboard",
	"vectorize",
	"d1",
];
const TIERS = ["", "free", "pro", "business", "enterprise"];

export function FilterBar({ initialValues, onApply }: FilterBarProps) {
	const [values, setValues] = useState(initialValues);

	return (
		<form
			className="filter-bar"
			onSubmit={(event) => {
				event.preventDefault();
				onApply(values);
			}}
		>
			<select
				value={values.source}
				onChange={(event) =>
					setValues((current) => ({ ...current, source: event.target.value }))
				}
			>
				{SOURCES.map((option) => (
					<option key={option || "all"} value={option}>
						{option ? option : "All sources"}
					</option>
				))}
			</select>

			<select
				value={values.product_area}
				onChange={(event) =>
					setValues((current) => ({
						...current,
						product_area: event.target.value,
					}))
				}
			>
				{PRODUCT_AREAS.map((option) => (
					<option key={option || "all"} value={option}>
						{option ? option.replace(/_/g, " ") : "All products"}
					</option>
				))}
			</select>

			<select
				value={values.account_tier}
				onChange={(event) =>
					setValues((current) => ({
						...current,
						account_tier: event.target.value,
					}))
				}
			>
				{TIERS.map((option) => (
					<option key={option || "all"} value={option}>
						{option ? option : "All tiers"}
					</option>
				))}
			</select>

			<input
				type="date"
				value={values.from}
				onChange={(event) =>
					setValues((current) => ({ ...current, from: event.target.value }))
				}
			/>

			<input
				type="date"
				value={values.to}
				onChange={(event) =>
					setValues((current) => ({ ...current, to: event.target.value }))
				}
			/>

			<div className="filter-bar__actions">
				<button type="submit">Apply filters</button>
				<button
					type="button"
					className="button-secondary"
					onClick={() => {
						const resetValues = {
							source: "",
							product_area: "",
							account_tier: "",
							from: "",
							to: "",
						};
						setValues(resetValues);
						onApply(resetValues);
					}}
				>
					Reset
				</button>
			</div>
		</form>
	);
}
