"use client";

import { useLocale } from "@/components/locale-provider";

// Shared site footer (every page), with the original source and author links.
export function SiteFooter() {
	const { t } = useLocale();
	return (
		<footer className="site-footer">
			<a
				href="https://github.com/dhckdgjs/github-unlisted"
				target="_blank"
				rel="noopener"
			>
				{t("MST 자체 운영 포크", "MST self-hosted fork")} ·{" "}
				<span className="url">{t("소스 코드", "Source Code")}</span>
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
				{t(
					"Rév의 github-unlisted를 기반으로 제작",
					"Based on github-unlisted by Rév",
				)}
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
