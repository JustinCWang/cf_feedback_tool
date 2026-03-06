import { NavLink } from "react-router-dom";
import cloudflareLogo from "../assets/cloudflare.png";

const NAV_ITEMS = [
	{ to: "/overview", label: "Overview" },
	{ to: "/inbox", label: "Inbox" },
	{ to: "/trends", label: "Trends" },
	{ to: "/ingest", label: "Ingest" },
	{ to: "/themes", label: "Themes" },
	{ to: "/digests", label: "Digests" },
];

export function SidebarNav() {
	return (
		<aside className="sidebar">
			<div className="sidebar__brand">
				<img
					src={cloudflareLogo}
					alt="Cloudflare logo"
					className="sidebar__logo-image"
				/>
				<div>
					<p className="sidebar__eyebrow">Cloudflare PM</p>
					<h2>Feedback Console</h2>
				</div>
			</div>

			<nav className="sidebar__nav" aria-label="Primary">
				{NAV_ITEMS.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						className={({ isActive }) =>
							isActive ? "sidebar__link sidebar__link--active" : "sidebar__link"
						}
					>
						{item.label}
					</NavLink>
				))}
			</nav>
		</aside>
	);
}
