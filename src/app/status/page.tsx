import "@/styles/global.css";
import { NavLinks } from "@/components/nav-links";
import { SiteDrawer } from "@/components/site-drawer";
import { SiteFooter } from "@/components/site-footer";
import { pageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
	title: "Instance status",
	description:
		"This is the MST / dhckdgjs self-hosted instance. This page is informational, not an automated uptime monitor.",
	path: "/status",
});

export default async function Page() {
	const session = await getSession();
	return (
		<div className="page-shell">
			<header className="topbar">
				<a className="wordmark" href="/">
					MST Unlisted Repo
				</a>
				<NavLinks signedIn={Boolean(session)} active="status" />
				<SiteDrawer signedIn={Boolean(session)} active="status" />
			</header>
			<main className="legal-content">
				<div className="legal-content__inner legal">
					<h1>Instance status</h1>
					<p>
						This is the MST / dhckdgjs self-hosted instance. This page is
						informational, not an automated uptime monitor.
					</p>
					<p>
						If a shared link does not open, it may have expired, been revoked,
						or lost access to its GitHub repository. Contact the person who
						provided the link.
					</p>
					<p>
						The upstream project's incident history does not describe this
						deployment. Service availability also depends on GitHub, Vercel and
						Upstash.
					</p>
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
