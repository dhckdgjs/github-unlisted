import "@/styles/global.css";
import "@/styles/collections.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCollection } from "@/lib/collection-service";
import { translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Never put a collection's title, repositories, or bearer URL in previews.
const privateMetadata: Metadata = {
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

export async function generateMetadata(): Promise<Metadata> {
	const t = translator(await getLocale());
	const title = t("공유 카탈로그", "Shared collection");
	const description = t(
		"링크로 공유된 자료 모음입니다.",
		"A collection of items shared by link.",
	);
	return {
		...privateMetadata,
		title,
		description,
		openGraph: { title, description, url: "/", images: [] },
		twitter: { card: "summary", title, description, images: [] },
	};
}

export default async function PublicCollectionPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const locale = await getLocale();
	const t = translator(locale);
	const { id } = await params;
	const collection = await getPublicCollection(id);
	if (!collection) notFound();

	return (
		<main className="collection-shell collection-viewer" lang={locale}>
			<header className="collection-heading">
				<p className="collection-eyebrow">
					{t("링크 전용 공유 목록", "UNLISTED COLLECTION")}
				</p>
				<h1>{collection.title}</h1>
				{collection.description && (
					<p className="collection-description">{collection.description}</p>
				)}
				<p className="collection-privacy-note">
					{t(
						"이 링크를 가진 누구나 열람할 수 있습니다. 링크를 전달하면 받는 사람도 이 자료에 접근할 수 있습니다.",
						"Anyone with this link can view these items. If you forward the link, its recipient can access them too.",
					)}
				</p>
			</header>
			{collection.items.length > 0 ? (
				<ol
					className="collection-cards"
					aria-label={t("공유 자료", "Shared items")}
				>
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
											{t("README 열기", "Open README")}{" "}
											<span aria-hidden="true">↗</span>
										</a>
										{item.showReleases && (
											<a
												className="collection-button"
												href={`${base}/releases${query}`}
												rel="noreferrer"
												referrerPolicy="no-referrer"
											>
												{t("Releases 열기", "Open Releases")}{" "}
												<span aria-hidden="true">↗</span>
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
					<h2>
						{t(
							"현재 열 수 있는 자료가 없습니다",
							"No items are currently available",
						)}
					</h2>
					<p>
						{t(
							"카탈로그 소유자에게 자료 추가 또는 공유 링크 상태를 확인해 주세요.",
							"Ask the collection owner to add items or check the share links.",
						)}
					</p>
				</div>
			)}
			<footer className="collection-footnote">
				{t(
					"공유가 중지되거나 만료된 자료는 표시되지 않습니다.",
					"Revoked or expired shares are not displayed.",
				)}
			</footer>
		</main>
	);
}
