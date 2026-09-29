import "@/styles/global.css";
import "@/styles/collections.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCollection } from "@/lib/collection-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Never put a collection's title, repositories, or bearer URL in previews.
export const metadata: Metadata = {
	title: "공유 카탈로그",
	description: "링크로 공유된 자료 모음입니다.",
	alternates: { canonical: null },
	robots: { index: false, follow: false, noarchive: true },
	referrer: "no-referrer",
	openGraph: {
		title: "공유 카탈로그",
		description: "링크로 공유된 자료 모음입니다.",
		url: "/",
		images: [],
	},
	twitter: {
		card: "summary",
		title: "공유 카탈로그",
		description: "링크로 공유된 자료 모음입니다.",
		images: [],
	},
};

export default async function PublicCollectionPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const collection = await getPublicCollection(id);
	if (!collection) notFound();

	return (
		<main className="collection-shell collection-viewer" lang="ko">
			<header className="collection-heading">
				<p className="collection-eyebrow">UNLISTED COLLECTION</p>
				<h1>{collection.title}</h1>
				{collection.description && (
					<p className="collection-description">{collection.description}</p>
				)}
				<p className="collection-privacy-note">
					이 링크를 가진 누구나 열람할 수 있습니다. 링크를 전달하면 받는 사람도
					이 자료에 접근할 수 있습니다.
				</p>
			</header>
			{collection.items.length > 0 ? (
				<ol className="collection-cards" aria-label="공유 자료">
					{collection.items.map((item, index) => {
						const base = `/${encodeURIComponent(item.owner)}/${encodeURIComponent(item.repo)}`;
						const query = `?s=${encodeURIComponent(item.shareId)}`;
						return (
							<li className="collection-card" key={item.shareId}>
								<span className="collection-card__number" aria-hidden="true">
									{String(index + 1).padStart(2, "0")}
								</span>
								<div className="collection-card__body">
									<p className="collection-repo">
										<code>
											{item.owner}/{item.repo}
										</code>
									</p>
									<h2>{item.label || item.repo}</h2>
									{item.description && (
										<p className="collection-description">{item.description}</p>
									)}
									<div className="collection-actions">
										<a
											className="collection-button collection-button--primary"
											href={`${base}${query}`}
											rel="noreferrer"
											referrerPolicy="no-referrer"
										>
											README 열기 <span aria-hidden="true">↗</span>
										</a>
										{item.showReleases && (
											<a
												className="collection-button"
												href={`${base}/releases${query}`}
												rel="noreferrer"
												referrerPolicy="no-referrer"
											>
												Releases 열기 <span aria-hidden="true">↗</span>
											</a>
										)}
									</div>
								</div>
							</li>
						);
					})}
				</ol>
			) : (
				<div className="collection-empty">
					<h2>현재 열 수 있는 자료가 없습니다</h2>
					<p>
						카탈로그 소유자에게 자료 추가 또는 공유 링크 상태를 확인해 주세요.
					</p>
				</div>
			)}
			<footer className="collection-footnote">
				공유가 중지되거나 만료된 자료는 표시되지 않습니다.
			</footer>
		</main>
	);
}
