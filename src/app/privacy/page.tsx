import "@/styles/global.css";
import { NavLinks } from "@/components/nav-links";
import { SiteDrawer } from "@/components/site-drawer";
import { SiteFooter } from "@/components/site-footer";
import { pageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
	title: "Privacy and sharing",
	description:
		"This is a self-hosted github-unlisted instance operated by MST / dhckdgjs, independent of the upstream public service.",
	path: "/privacy",
});

export default async function Page() {
	const session = await getSession();
	return (
		<div className="page-shell">
			<header className="topbar">
				<a className="wordmark" href="/">
					MST Unlisted Repo
				</a>
				<NavLinks signedIn={Boolean(session)} active="privacy" />
				<SiteDrawer signedIn={Boolean(session)} active="privacy" />
			</header>
			<main className="legal-content">
				<div className="legal-content__inner legal">
					<h1>Privacy and sharing</h1>
					<p>
						This is a self-hosted github-unlisted instance operated by MST /
						dhckdgjs, independent of the upstream public service.
					</p>
					<p>
						The server uses a read-only GitHub App to retrieve content from
						selected repositories. GitHub, Vercel and Upstash process requests
						or service data required to operate this instance. Repository
						content passes through the server; this is not end-to-end encrypted.
					</p>
					<p>
						Share records and expiry settings are stored in Redis. Sign-in uses
						a session cookie. Hosting and security providers may process request
						metadata. Contact email delivery is disabled unless explicitly
						configured by the operator.
					</p>
					<p>
						Anyone with a valid share link can read the shared repository, not
						just its README. Links may also expose release notes and downloads
						when enabled. Treat the URL as a secret; copied or downloaded
						content cannot be recalled.
					</p>
					<p>
						Repository owners can revoke links in the dashboard and remove the
						GitHub App installation in GitHub settings. For questions, contact
						the person who provided your link.
					</p>
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
