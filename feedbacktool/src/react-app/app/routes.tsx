import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { DigestsPage } from "../pages/DigestsPage";
import { InboxPage } from "../pages/InboxPage";
import { IngestPage } from "../pages/IngestPage";
import { OverviewPage } from "../pages/OverviewPage";
import { ThemesPage } from "../pages/ThemesPage";
import { TrendsPage } from "../pages/TrendsPage";

export function AppRoutes() {
	return (
		<BrowserRouter>
			<Routes>
				<Route element={<AppShell />}>
					<Route path="/" element={<Navigate to="/overview" replace />} />
					<Route path="/overview" element={<OverviewPage />} />
					<Route path="/inbox" element={<InboxPage />} />
					<Route path="/trends" element={<TrendsPage />} />
					<Route path="/ingest" element={<IngestPage />} />
					<Route path="/themes" element={<ThemesPage />} />
					<Route path="/digests" element={<DigestsPage />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}
