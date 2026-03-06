import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getHealth } from "../lib/api";
import { SidebarNav } from "./SidebarNav";
import { TopBar } from "./TopBar";

export function AppShell() {
	const [healthStatus, setHealthStatus] = useState<"loading" | "healthy" | "error">(
		"loading",
	);
	const [lastChecked, setLastChecked] = useState<string | undefined>(undefined);

	useEffect(() => {
		let cancelled = false;

		async function loadHealth() {
			try {
				const result = await getHealth();
				if (!cancelled) {
					setHealthStatus(result.status === "ok" ? "healthy" : "error");
					setLastChecked(result.time);
				}
			} catch {
				if (!cancelled) {
					setHealthStatus("error");
				}
			}
		}

		void loadHealth();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="dashboard-shell">
			<SidebarNav />
			<div className="dashboard-shell__main">
				<TopBar healthStatus={healthStatus} lastChecked={lastChecked} />
				<main className="dashboard-shell__content">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
