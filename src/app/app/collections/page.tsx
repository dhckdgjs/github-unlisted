import "@/styles/global.css";
import "@/styles/collections.css";
import { CollectionManager } from "@/components/collection-manager";
import { listCollections } from "@/lib/collection-store";
import { pageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/session";
import { listSharesForInstallation } from "@/lib/share-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
	...pageMetadata({ title: "공유 목록 관리", index: false }),
	referrer: "no-referrer" as const,
};

export default async function CollectionsPage() {
	const session = await getSession();
	if (!session) {
		return (
			<main className="collection-shell collection-signin" lang="ko">
				<p className="collection-eyebrow">UNLISTED COLLECTIONS</p>
				<h1>공유 목록 관리</h1>
				<p>
					GitHub에 로그인하면 기존 공유 링크를 하나의 카탈로그로 모을 수
					있습니다.
				</p>
				<a
					className="collection-button collection-button--primary"
					href="/api/github/login"
				>
					GitHub 로그인
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
			<main className="collection-shell collection-signin" lang="ko">
				<h1>카탈로그를 불러오지 못했습니다</h1>
				<p>
					잠시 후 다시 시도해 주세요. 저장된 카탈로그는 변경되지 않았습니다.
				</p>
				<a className="collection-button" href="/app/collections">
					다시 시도
				</a>
				<a className="collection-text-link" href="/app">
					저장소 관리로 돌아가기
				</a>
			</main>
		);
	}
}
