// Shared site footer (every page). Two static links: the project source
// and the author's site. Server-neutral so it can be used in both server
// pages and the client dashboard. (Contact moved to the nav / drawer.)
export function SiteFooter() {
	return (
		<footer className="site-footer">
			<a
				href="https://github.com/dhckdgjs/github-unlisted"
				target="_blank"
				rel="noopener"
			>
				MST self-hosted fork · <span className="url">Source Code</span>
				<svg
					width="11"
					height="11"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="M7 17L17 7" />
					<polyline points="7 7 17 7 17 17" />
				</svg>
			</a>
			<a href="https://www.revoconner.com" target="_blank" rel="noopener">
				Based on github-unlisted by R&eacute;v
				<svg
					width="11"
					height="11"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="M7 17L17 7" />
					<polyline points="7 7 17 7 17 17" />
				</svg>
			</a>
		</footer>
	);
}
