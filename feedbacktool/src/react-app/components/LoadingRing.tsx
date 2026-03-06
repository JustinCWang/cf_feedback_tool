type LoadingRingProps = {
	label?: string;
	size?: "sm" | "md";
};

export function LoadingRing({
	label = "Loading",
	size = "md",
}: LoadingRingProps) {
	return (
		<span
			className={`loading-ring loading-ring--${size}`}
			role="status"
			aria-label={label}
		/>
	);
}
