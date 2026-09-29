"use client";

import { useEffect, useState } from "react";
import { useClientLocalePage, useLocale } from "@/components/locale-provider";
import type { CollectionRecord } from "@/lib/collection-store";

interface AvailableShare {
	id: string;
	owner: string;
	repo: string;
	showReleases: boolean;
}

type Draft = Pick<CollectionRecord, "title" | "description" | "items">;
const emptyDraft = (): Draft => ({ title: "", description: "", items: [] });
const toDraft = (collection: CollectionRecord): Draft => ({
	title: collection.title,
	description: collection.description,
	items: collection.items.map((item) => ({ ...item })),
});

function collectionMessage(
	value: string,
	t: (ko: string, en: string) => string,
) {
	const messages: [string, string][] = [
		[
			"저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
			"Could not save. Please try again shortly.",
		],
		[
			"저장했습니다. 공유 주소는 계속 유지됩니다.",
			"Saved. Your share URL stays the same.",
		],
		["카탈로그 공유를 다시 시작했습니다.", "Collection sharing has resumed."],
		[
			"카탈로그 공유를 중지했습니다. 개별 저장소의 공유 링크는 유지됩니다.",
			"Collection sharing has stopped. Individual repository links remain active.",
		],
		["요청을 완료하지 못했습니다.", "Could not complete the request."],
		["공유 링크를 복사했습니다.", "Share link copied."],
		[
			"링크를 복사하지 못했습니다. 아래 공유 주소를 직접 복사해 주세요.",
			"Could not copy the link. Copy the share URL below manually.",
		],
		["로그인이 필요합니다.", "Not signed in"],
		[
			"요청 출처가 올바르지 않습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
			"Invalid request origin",
		],
		[
			"공유 목록 서비스를 일시적으로 사용할 수 없습니다.",
			"Collection service is unavailable",
		],
		["목록을 찾을 수 없습니다.", "Not found"],
		[
			"공유 링크를 사용할 수 없거나 만료되었습니다.",
			"A share is unavailable or expired",
		],
		[
			"이 계정의 앱에 연결된 공유 링크가 아닙니다.",
			"A share is not owned by your installations",
		],
		[
			"현재 저장소 접근 권한을 확인할 수 없습니다.",
			"Could not verify current repository access",
		],
		[
			"공유 링크의 저장소 접근 권한이 없어졌습니다.",
			"A share no longer has repository access",
		],
		["제목을 입력해 주세요.", "Title is required"],
		[
			"공유 목록에는 최대 50개까지 추가할 수 있습니다.",
			"A collection supports at most 50 items",
		],
	];
	const pair = messages.find(([ko, en]) => value === ko || value === en);
	return pair ? t(...pair) : value;
}

export function CollectionManager({
	initialCollections,
	shares,
	login,
}: {
	initialCollections: CollectionRecord[];
	shares: AvailableShare[];
	login: string;
}) {
	const { locale, t } = useLocale();
	useClientLocalePage("공유 목록 관리", "Manage collections");
	const [collections, setCollections] = useState(initialCollections);
	const [selectedId, setSelectedId] = useState(initialCollections[0]?.id ?? "");
	const [draft, setDraft] = useState<Draft>(() =>
		initialCollections[0] ? toDraft(initialCollections[0]) : emptyDraft(),
	);
	const [addShareId, setAddShareId] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const selected = collections.find(
		(collection) => collection.id === selectedId,
	);
	const dirty =
		JSON.stringify(draft) !==
		JSON.stringify(selected ? toDraft(selected) : emptyDraft());
	const shareById = new Map(shares.map((share) => [share.id, share]));
	const available = shares.filter(
		(share) => !draft.items.some((item) => item.shareId === share.id),
	);
	const unavailableCount = draft.items.filter(
		(item) => !shareById.has(item.shareId),
	).length;
	const collectionPath = selected
		? `/collections/${encodeURIComponent(selected.id)}`
		: "";

	useEffect(() => {
		if (!dirty) return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);

	function selectCollection(id: string) {
		if (
			dirty &&
			!window.confirm(
				t(
					"저장하지 않은 변경 사항을 버리고 이동할까요?",
					"Discard unsaved changes and continue?",
				),
			)
		)
			return;
		const next = collections.find((collection) => collection.id === id);
		setSelectedId(id);
		setDraft(next ? toDraft(next) : emptyDraft());
		setAddShareId("");
		setError("");
		setNotice("");
	}

	function changeItem(index: number, patch: Partial<Draft["items"][number]>) {
		setDraft((current) => ({
			...current,
			items: current.items.map((item, i) =>
				i === index ? { ...item, ...patch } : item,
			),
		}));
	}

	function moveItem(index: number, direction: -1 | 1) {
		setDraft((current) => {
			const items = [...current.items];
			const target = index + direction;
			if (target < 0 || target >= items.length) return current;
			[items[index], items[target]] = [items[target], items[index]];
			return { ...current, items };
		});
	}

	async function persist(enabled?: boolean) {
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const payload =
				enabled === undefined
					? { ...draft, ...(selected ? { id: selected.id } : {}) }
					: { id: selected?.id, enabled };
			const response = await fetch("/api/collections", {
				method: selected ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = (await response.json().catch(() => null)) as {
				collection?: CollectionRecord;
				error?: string;
			} | null;
			if (!response.ok || !data?.collection)
				throw new Error(
					data?.error || "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
				);
			const saved = data.collection;
			setCollections((current) => [
				saved,
				...current.filter((collection) => collection.id !== saved.id),
			]);
			setSelectedId(saved.id);
			if (enabled === undefined) setDraft(toDraft(saved));
			setNotice(
				enabled === undefined
					? "저장했습니다. 공유 주소는 계속 유지됩니다."
					: enabled
						? "카탈로그 공유를 다시 시작했습니다."
						: "카탈로그 공유를 중지했습니다. 개별 저장소의 공유 링크는 유지됩니다.",
			);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "요청을 완료하지 못했습니다.",
			);
		} finally {
			setBusy(false);
		}
	}

	async function copyLink() {
		setError("");
		try {
			await navigator.clipboard.writeText(
				new URL(collectionPath, window.location.origin).href,
			);
			setNotice("공유 링크를 복사했습니다.");
		} catch {
			setError(
				"링크를 복사하지 못했습니다. 아래 공유 주소를 직접 복사해 주세요.",
			);
		}
	}

	return (
		<main className="collection-shell collection-manager" lang={locale}>
			<header className="collection-heading">
				<div className="collection-topline">
					<a className="collection-text-link" href="/app">
						{t("← 저장소 관리", "← Repositories")}
					</a>
					<span>{login}</span>
				</div>
				<p className="collection-eyebrow">
					{t("링크 전용 공유 목록", "UNLISTED COLLECTIONS")}
				</p>
				<h1>{t("공유 목록 관리", "Manage collections")}</h1>
				<p className="collection-description">
					{t(
						"기존 공유 링크를 모아 하나의 주소로 전달하세요. 자료와 설명, 순서를 바꿔도 카탈로그 주소는 유지됩니다.",
						"Bring existing share links together in one place. Your collection URL stays the same when you change its items, descriptions, or order.",
					)}
				</p>
			</header>

			<section
				className="collection-panel"
				aria-label={t("목록 선택", "Select collection")}
			>
				<div className="collection-picker">
					<label className="collection-field">
						{t("목록 선택", "Select collection")}
						<select
							value={selectedId}
							disabled={busy}
							onChange={(event) => selectCollection(event.target.value)}
						>
							<option value="">{t("새 카탈로그", "New collection")}</option>
							{collections.map((collection) => (
								<option key={collection.id} value={collection.id}>
									{collection.title}
									{collection.enabled ? "" : t(" (공유 중지)", " (disabled)")}
								</option>
							))}
						</select>
					</label>
					<button
						className="collection-button"
						type="button"
						disabled={busy || !selectedId}
						onClick={() => selectCollection("")}
					>
						{t("새로 만들기", "Create new")}
					</button>
				</div>
				<p className="collection-hint">
					{t(
						"로그인 계정에 연결된 기존 공유 링크만 추가할 수 있습니다. 새 저장소를 공유하려면 먼저 ",
						"You can add existing shares linked to your account. To share another repository, first create a link in ",
					)}
					<a className="collection-text-link" href="/app">
						{t("저장소 관리", "Repositories")}
					</a>
					{t("에서 공유 링크를 만드세요.", ".")}
				</p>
			</section>

			<form
				onSubmit={(event) => {
					event.preventDefault();
					void persist();
				}}
			>
				<fieldset disabled={busy} className="collection-form-fields">
					<section
						className="collection-panel"
						aria-labelledby="collection-details-heading"
					>
						<h2 id="collection-details-heading">
							{t("카탈로그 소개", "Collection details")}
						</h2>
						<label className="collection-field">
							{t("제목", "Title")}
							<input
								required
								maxLength={120}
								value={draft.title}
								onChange={(event) =>
									setDraft((current) => ({
										...current,
										title: event.target.value,
									}))
								}
								placeholder={t(
									"공유할 자료 모음의 제목",
									"A title for your collection",
								)}
							/>
						</label>
						<label className="collection-field">
							{t("설명", "Description")}
							<textarea
								rows={3}
								maxLength={1000}
								value={draft.description}
								onChange={(event) =>
									setDraft((current) => ({
										...current,
										description: event.target.value,
									}))
								}
								placeholder={t(
									"이 카탈로그에 담긴 자료를 소개해 주세요.",
									"Introduce the items in this collection.",
								)}
							/>
						</label>
					</section>

					<section
						className="collection-panel"
						aria-labelledby="collection-items-heading"
					>
						<div className="collection-section-title">
							<h2 id="collection-items-heading">
								{t("공유 자료", "Shared items")}
							</h2>
							<span className="collection-hint">{draft.items.length} / 50</span>
						</div>
						<div className="collection-picker">
							<label className="collection-field">
								{t("추가할 저장소", "Repository to add")}
								<select
									value={addShareId}
									disabled={available.length === 0 || draft.items.length >= 50}
									onChange={(event) => setAddShareId(event.target.value)}
								>
									<option value="">
										{t("기존 공유 링크 선택", "Select an existing share")}
									</option>
									{available.map((share) => (
										<option key={share.id} value={share.id}>
											{share.owner}/{share.repo}
											{share.showReleases
												? t(" · Releases 포함", " · Releases included")
												: ""}
										</option>
									))}
								</select>
							</label>
							<button
								type="button"
								className="collection-button"
								disabled={!addShareId || draft.items.length >= 50}
								onClick={() => {
									const share = shareById.get(addShareId);
									if (
										!share ||
										draft.items.some((item) => item.shareId === share.id)
									)
										return;
									setDraft((current) => ({
										...current,
										items: [
											...current.items,
											{ shareId: share.id, label: share.repo, description: "" },
										],
									}));
									setAddShareId("");
								}}
							>
								{t("자료 추가", "Add item")}
							</button>
						</div>
						{shares.length === 0 && (
							<p className="collection-hint">
								{t(
									"추가할 수 있는 공유 링크가 없습니다. 저장소 관리에서 먼저 링크를 만들어 주세요.",
									"No shares are available. Create a share link in Repositories first.",
								)}
							</p>
						)}
						{draft.items.length === 0 && (
							<p className="collection-empty">
								{t(
									"아직 추가한 자료가 없습니다. 위에서 저장소를 선택해 주세요.",
									"No items yet. Select a repository above.",
								)}
							</p>
						)}
						{unavailableCount > 0 && (
							<p className="collection-warning">
								{t(
									`현재 사용할 수 없는 공유 링크가 ${unavailableCount}개 있습니다. 해당 자료를 제거하거나 저장소 관리에서 공유 상태를 확인한 뒤 다시 불러와 주세요.`,
									`${unavailableCount} share link(s) are unavailable. Remove those items or check their sharing status in Repositories, then reload.`,
								)}
							</p>
						)}
						<ol
							className="collection-edit-items"
							aria-label={t("자료 편집", "Edit items")}
						>
							{draft.items.map((item, index) => {
								const share = shareById.get(item.shareId);
								return (
									<li className="collection-edit-item" key={item.shareId}>
										<div className="collection-item-topline">
											<p className="collection-repo">
												<span className="collection-item-index">
													{index + 1}.
												</span>{" "}
												{share
													? `${share.owner}/${share.repo}`
													: t("사용할 수 없는 공유 링크", "Unavailable share")}
											</p>
											<div className="collection-item-actions">
												<button
													type="button"
													className="collection-button collection-button--small"
													aria-label={t(
														`${index + 1}번 자료 위로`,
														`Move item ${index + 1} up`,
													)}
													disabled={index === 0}
													onClick={() => moveItem(index, -1)}
												>
													↑
												</button>
												<button
													type="button"
													className="collection-button collection-button--small"
													aria-label={t(
														`${index + 1}번 자료 아래로`,
														`Move item ${index + 1} down`,
													)}
													disabled={index === draft.items.length - 1}
													onClick={() => moveItem(index, 1)}
												>
													↓
												</button>
												<button
													type="button"
													className="collection-button collection-button--small"
													aria-label={t(
														`${index + 1}번 자료 제거`,
														`Remove item ${index + 1}`,
													)}
													onClick={() =>
														setDraft((current) => ({
															...current,
															items: current.items.filter(
																(_, i) => i !== index,
															),
														}))
													}
												>
													{t("제거", "Remove")}
												</button>
											</div>
										</div>
										<label className="collection-field">
											{t("표시 이름", "Display name")} {index + 1}
											<input
												maxLength={100}
												value={item.label}
												onChange={(event) =>
													changeItem(index, { label: event.target.value })
												}
												placeholder={share?.repo || t("자료 이름", "Item name")}
											/>
										</label>
										<label className="collection-field">
											{t("자료 설명", "Item description")} {index + 1}
											<textarea
												rows={2}
												maxLength={300}
												value={item.description}
												onChange={(event) =>
													changeItem(index, { description: event.target.value })
												}
												placeholder={t(
													"자료의 내용과 용도를 설명해 주세요.",
													"Describe what this item is for.",
												)}
											/>
										</label>
										{share && (
											<p className="collection-hint">
												{t("README 열기", "Open README")}
												{share.showReleases
													? t(" · Releases 열기", " · Open Releases")
													: ""}
											</p>
										)}
									</li>
								);
							})}
						</ol>
					</section>
					<div className="collection-save-bar">
						<span className="collection-hint">
							{dirty
								? t(
										"저장하지 않은 변경 사항이 있습니다.",
										"You have unsaved changes.",
									)
								: selected
									? t("저장된 내용입니다.", "All changes saved.")
									: t(
											"저장하면 공유 주소가 만들어집니다.",
											"Save to create a share URL.",
										)}
						</span>
						<button
							type="submit"
							className="collection-button collection-button--primary"
							disabled={
								!draft.title.trim() ||
								unavailableCount > 0 ||
								(!!selected && !dirty)
							}
						>
							{busy
								? t("처리 중…", "Working…")
								: selected
									? t("변경 사항 저장", "Save changes")
									: t("카탈로그 만들기", "Create collection")}
						</button>
					</div>
				</fieldset>
			</form>

			{error && (
				<p
					className="collection-message collection-message--error"
					role="alert"
				>
					{collectionMessage(error, t)}
				</p>
			)}
			{notice && (
				<p className="collection-message" role="status">
					{collectionMessage(notice, t)}
				</p>
			)}

			{selected && (
				<section
					className="collection-panel collection-share-panel"
					aria-labelledby="collection-share-heading"
				>
					<div className="collection-section-title">
						<h2 id="collection-share-heading">
							{t("공유 링크", "Share link")}
						</h2>
						<span
							className={`collection-status${selected.enabled ? "" : " collection-status--off"}`}
						>
							{selected.enabled
								? t("공유 중", "Sharing enabled")
								: t("공유 중지", "Sharing disabled")}
						</span>
					</div>
					<a
						className="collection-share-url"
						href={collectionPath}
						rel="noreferrer"
						referrerPolicy="no-referrer"
						target="_blank"
					>
						{collectionPath}
					</a>
					<p className="collection-privacy-note">
						{t(
							"이 주소를 가진 누구나 카탈로그와 연결된 자료를 열람하고 링크를 재전달할 수 있습니다. 공유 중지는 카탈로그에만 적용되며, 이미 전달한 개별 저장소 링크는 저장소 관리에서 별도로 중지해야 합니다.",
							"Anyone with this URL can view the collection and linked items, and forward the link. Disabling this collection does not revoke individual repository links. Revoke those separately in Repositories.",
						)}
					</p>
					<div className="collection-actions">
						<button
							className="collection-button collection-button--primary"
							type="button"
							disabled={busy}
							onClick={() => void copyLink()}
						>
							{t("링크 복사", "Copy link")}
						</button>
						<a
							className="collection-button"
							href={collectionPath}
							rel="noreferrer"
							referrerPolicy="no-referrer"
							target="_blank"
						>
							{t("카탈로그 열기 ↗", "Open collection ↗")}
						</a>
						<button
							className="collection-button collection-button--toggle"
							type="button"
							disabled={busy}
							onClick={() => void persist(!selected.enabled)}
						>
							{selected.enabled
								? t("공유 중지", "Disable sharing")
								: t("공유 다시 시작", "Resume sharing")}
						</button>
					</div>
				</section>
			)}
		</main>
	);
}
