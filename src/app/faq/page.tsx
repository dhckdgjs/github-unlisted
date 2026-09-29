import "@/styles/global.css";
import { FaqAccordion } from "@/components/faq-accordion";
import { JsonLd } from "@/components/json-ld";
import { NavLinks } from "@/components/nav-links";
import { SiteDrawer } from "@/components/site-drawer";
import { SiteFooter } from "@/components/site-footer";
import { translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
	const t = translator(await getLocale());
	return pageMetadata({
		title: t("자주 묻는 질문", "FAQ"),
		description: t(
			"Unlisted Repo의 비공개 저장소 공유, 접근 제어, 링크 폐기 방식에 관한 자주 묻는 질문입니다.",
			"Frequently asked questions about Unlisted Repo — how private repo sharing, access control, and link revocation work.",
		),
		path: "/faq",
	});
}

export default async function FaqPage() {
	const session = await getSession();
	const t = translator(await getLocale());

	return (
		<div className="page-shell">
			<header className="topbar">
				<a
					className="wordmark"
					href="/"
					aria-label={t("GitHub Unlisted 홈", "github unlisted home")}
				>
					<span className="mark" aria-hidden="true">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<title>unlisted</title>
							<line
								x1="2"
								y1="11"
								x2="11"
								y2="2"
								stroke="currentColor"
								strokeWidth="1.6"
								strokeLinecap="round"
							/>
							<line
								x1="5"
								y1="14"
								x2="14"
								y2="5"
								stroke="currentColor"
								strokeWidth="1.6"
								strokeLinecap="round"
								opacity="0.55"
							/>
							<line
								x1="8"
								y1="17"
								x2="17"
								y2="8"
								stroke="currentColor"
								strokeWidth="1.6"
								strokeLinecap="round"
								opacity="0.25"
							/>
						</svg>
					</span>
					<span className="word">
						<span className="pre">github</span>{" "}
						<span className="post">unlisted</span>
					</span>
				</a>

				<NavLinks signedIn={Boolean(session)} active="faq" />

				{session ? (
					<a className="nav-cta" href="/api/github/logout">
						{t("로그아웃", "Sign Out")}
					</a>
				) : (
					<a className="nav-cta" href="/api/github/login">
						{t("로그인", "Sign In")}
					</a>
				)}

				<SiteDrawer signedIn={Boolean(session)} active="faq" />
			</header>

			<main className="faq-content">
				<div className="faq-content__inner">
					<h1 className="faq-title">
						{t("궁금한 점이 있나요?", "Questions?")}
					</h1>

					<p className="faq-lede">
						{t(
							"자주 묻는 질문을 모았습니다. 더 궁금한 점이 있다면 GitHub에서 소스 코드를 확인할 수 있습니다.",
							"A short list. If you have something else on your mind, the source is on GitHub.",
						)}
					</p>

					<FaqAccordion />
				</div>
			</main>

			<SiteFooter />

			<JsonLd
				data={breadcrumbLd([
					{ name: t("홈", "Home"), path: "/" },
					{ name: t("자주 묻는 질문", "FAQ"), path: "/faq" },
				])}
			/>
		</div>
	);
}
