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
		title: t("개인정보 및 공유 안내", "Privacy and sharing"),
		description: t(
			"이 사이트는 MST / dhckdgjs가 직접 운영하는 github-unlisted 인스턴스이며, 원본 프로젝트의 공개 서비스와는 별개입니다.",
			"This is a self-hosted github-unlisted instance operated by MST / dhckdgjs, independent of the upstream public service.",
		),
		path: "/privacy",
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
				<NavLinks signedIn={Boolean(session)} active="privacy" />
				<SiteDrawer signedIn={Boolean(session)} active="privacy" />
			</header>
			<main className="legal-content">
				<div className="legal-content__inner legal">
					<h1>{t("개인정보 및 공유 안내", "Privacy and sharing")}</h1>
					<p>
						{t(
							"이 사이트는 MST / dhckdgjs가 직접 운영하는 github-unlisted 인스턴스이며, 원본 프로젝트의 공개 서비스와는 별개입니다.",
							"This is a self-hosted github-unlisted instance operated by MST / dhckdgjs, independent of the upstream public service.",
						)}
					</p>
					<p>
						{t(
							"서버는 읽기 전용 GitHub App을 사용해 선택된 저장소의 콘텐츠를 가져옵니다. GitHub, Vercel, Upstash는 이 인스턴스의 운영에 필요한 요청이나 서비스 데이터를 처리합니다. 저장소 콘텐츠는 서버를 거치며, 종단간 암호화되지 않습니다.",
							"The server uses a read-only GitHub App to retrieve content from selected repositories. GitHub, Vercel and Upstash process requests or service data required to operate this instance. Repository content passes through the server; this is not end-to-end encrypted.",
						)}
					</p>
					<p>
						{t(
							"공유 기록과 만료 설정은 Redis에 저장됩니다. 로그인에는 세션 쿠키를 사용합니다. 언어를 변경하면 이 호스트에만 적용되는 unlisted_locale 쿠키에 언어 선택값(ko 또는 en)만 1년간 저장됩니다. 이 쿠키는 추적용이 아닙니다. 호스팅 및 보안 서비스 제공업체가 요청 메타데이터를 처리할 수 있습니다. 문의 이메일 전송은 운영자가 명시적으로 설정한 경우에만 활성화됩니다.",
							"Share records and expiry settings are stored in Redis. Sign-in uses a session cookie. When you change the language, a host-only unlisted_locale cookie stores only your language choice (ko or en) for one year. This preference cookie is not used for tracking. Hosting and security providers may process request metadata. Contact email delivery is disabled unless explicitly configured by the operator.",
						)}
					</p>
					<p>
						{t(
							"유효한 공유 링크를 가진 누구나 README뿐 아니라 공유된 저장소를 읽을 수 있습니다. 해당 기능이 활성화되어 있으면 릴리스 노트와 다운로드에도 접근할 수 있습니다. URL을 비밀 정보로 취급하세요. 이미 복사하거나 다운로드한 콘텐츠는 회수할 수 없습니다.",
							"Anyone with a valid share link can read the shared repository, not just its README. Links may also expose release notes and downloads when enabled. Treat the URL as a secret; copied or downloaded content cannot be recalled.",
						)}
					</p>
					<p>
						{t(
							"저장소 소유자는 대시보드에서 링크를 폐기하고 GitHub 설정에서 GitHub App을 제거할 수 있습니다. 궁금한 점은 링크를 전달한 사람에게 문의하세요.",
							"Repository owners can revoke links in the dashboard and remove the GitHub App installation in GitHub settings. For questions, contact the person who provided your link.",
						)}
					</p>
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
