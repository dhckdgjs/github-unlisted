import "@/styles/global.css";
import { NavLinks } from "@/components/nav-links";
import { SiteDrawer } from "@/components/site-drawer";
import { SiteFooter } from "@/components/site-footer";
import { translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { pageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
	const t = translator(await getLocale());
	return pageMetadata({
		title: t("서비스 상태", "Instance status"),
		description: t(
			"이 사이트는 MST / dhckdgjs가 직접 운영하는 인스턴스입니다. 이 페이지는 안내용이며, 가동 상태를 자동으로 모니터링하지 않습니다.",
			"This is the MST / dhckdgjs self-hosted instance. This page is informational, not an automated uptime monitor.",
		),
		path: "/status",
	});
}

export default async function Page() {
	const session = await getSession();
	const t = translator(await getLocale());
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
					<h1>{t("서비스 상태", "Instance status")}</h1>
					<p>
						{t(
							"이 사이트는 MST / dhckdgjs가 직접 운영하는 인스턴스입니다. 이 페이지는 안내용이며, 가동 상태를 자동으로 모니터링하지 않습니다.",
							"This is the MST / dhckdgjs self-hosted instance. This page is informational, not an automated uptime monitor.",
						)}
					</p>
					<p>
						{t(
							"공유 링크가 열리지 않으면 링크가 만료 또는 폐기되었거나 GitHub 저장소에 대한 접근 권한이 없어졌을 수 있습니다. 링크를 전달한 사람에게 문의하세요.",
							"If a shared link does not open, it may have expired, been revoked, or lost access to its GitHub repository. Contact the person who provided the link.",
						)}
					</p>
					<p>
						{t(
							"원본 프로젝트의 장애 이력은 이 배포의 상태를 나타내지 않습니다. 서비스의 이용 가능 여부는 GitHub, Vercel, Upstash의 상태에도 영향을 받습니다.",
							"The upstream project's incident history does not describe this deployment. Service availability also depends on GitHub, Vercel and Upstash.",
						)}
					</p>
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
