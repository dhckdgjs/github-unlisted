import "@/styles/global.css";
import "@/styles/collections.css";
import { CollectionManager } from "@/components/collection-manager";
import { listCollections } from "@/lib/collection-store";
import { translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { pageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/session";
import { listSharesForInstallation } from "@/lib/share-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = translator(await getLocale());
	return {
		...pageMetadata({
			title: t("공유 목록 관리", "Manage collections"),
			index: false,
		}),
		referrer: "no-referrer" as const,
	};
}

export default async function CollectionsPage() {
	const locale = await getLocale();
	const t = translator(locale);
	const session = await getSession();
	if (!session) {
		return (
			<main className="collection-shell collection-signin" lang={locale}>
				<p className="collection-eyebrow">
					{t("링크 전용 공유 목록", "UNLISTED COLLECTIONS")}
				</p>
				<h1>{t("공유 목록 관리", "Manage collections")}</h1>
				<p>
					{t(
						"GitHub에 로그인하면 기존 공유 링크를 하나의 카탈로그로 모을 수 있습니다.",
						"Sign in with GitHub to combine existing share links into one collection.",
					)}
				</p>
				<a
					className="collection-button collection-button--primary"
					href="/api/github/login"
				>
					{t("GitHub 로그인", "Sign in with GitHub")}
				</a>
			</main>
		);
	}

	try {
		const [collections, shareLists] = await Promise.all([
			listCollections(session.userId),
			Promise.all(session.installationIds.map(listSharesForInstallation)),
		]);
		const now = Date.now();
		const shares = Array.from(
			new Map(
				shareLists
					.flat()
					.filter((share) => !share.expiresAt || share.expiresAt > now)
					.map((share) => [
						share.id,
						{
							id: share.id,
							owner: share.owner,
							repo: share.repo,
							showReleases: share.showReleases === true,
						},
					]),
			).values(),
		).sort((a, b) =>
			`${a.owner}/${a.repo}`.localeCompare(`${b.owner}/${b.repo}`),
		);

		return (
			<CollectionManager
				initialCollections={collections}
				shares={shares}
				login={session.login}
			/>
		);
	} catch {
		return (
			<main className="collection-shell collection-signin" lang={locale}>
				<h1>
					{t("카탈로그를 불러오지 못했습니다", "Could not load collections")}
				</h1>
				<p>
					{t(
						"잠시 후 다시 시도해 주세요. 저장된 카탈로그는 변경되지 않았습니다.",
						"Please try again shortly. Your saved collections have not changed.",
					)}
				</p>
				<a className="collection-button" href="/app/collections">
					{t("다시 시도", "Try again")}
				</a>
				<a className="collection-text-link" href="/app">
					{t("저장소 관리로 돌아가기", "Back to Repositories")}
				</a>
			</main>
		);
	}
}
