"use client";

import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";

// Capability URLs, repository names and owner dashboards are not telemetry.
// Also drop navigation events if the SDK was loaded on a public landing page.
export function isPublicAnalyticsUrl(value: string): boolean {
	try {
		const url = new URL(value, "https://example.invalid");
		return (
			["/", "/faq", "/privacy", "/status"].includes(url.pathname) &&
			!url.search &&
			!url.hash
		);
	} catch {
		return false;
	}
}

export function PublicSiteAnalytics() {
	const pathname = usePathname();
	if (!pathname || !isPublicAnalyticsUrl(pathname)) return null;
	return (
		<Analytics
			beforeSend={(event) => (isPublicAnalyticsUrl(event.url) ? event : null)}
		/>
	);
}
