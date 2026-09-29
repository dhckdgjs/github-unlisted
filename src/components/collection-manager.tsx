"use client";

import { useEffect, useState } from "react";
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

export function CollectionManager({
	initialCollections,
	shares,
	login,
}: {
	initialCollections: CollectionRecord[];
	shares: AvailableShare[];
	login: string;
}) {
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
			!window.confirm("저장하지 않은 변경 사항을 버리고 이동할까요?")
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
		<main className="collection-shell collection-manager" lang="ko">
			<header className="collection-heading">
				<div className="collection-topline">
					<a className="collection-text-link" href="/app">
						← 저장소 관리
					</a>
					<span>{login}</span>
				</div>
				<p className="collection-eyebrow">UNLISTED COLLECTIONS</p>
				<h1>공유 목록 관리</h1>
				<p className="collection-description">
					기존 공유 링크를 모아 하나의 주소로 전달하세요. 자료와 설명, 순서를
					바꿔도 카탈로그 주소는 유지됩니다.
				</p>
			</header>

			<section className="collection-panel" aria-label="목록 선택">
				<div className="collection-picker">
					<label className="collection-field">
						목록 선택
						<select
							value={selectedId}
							disabled={busy}
							onChange={(event) => selectCollection(event.target.value)}
						>
							<option value="">새 카탈로그</option>
							{collections.map((collection) => (
								<option key={collection.id} value={collection.id}>
									{collection.title}
									{collection.enabled ? "" : " (공유 중지)"}
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
						새로 만들기
					</button>
				</div>
				<p className="collection-hint">
					로그인 계정에 연결된 기존 공유 링크만 추가할 수 있습니다. 새 저장소를
					공유하려면 먼저{" "}
					<a className="collection-text-link" href="/app">
						저장소 관리
					</a>
					에서 공유 링크를 만드세요.
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
						<h2 id="collection-details-heading">카탈로그 소개</h2>
						<label className="collection-field">
							제목
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
								placeholder="공유할 자료 모음의 제목"
							/>
						</label>
						<label className="collection-field">
							설명
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
								placeholder="이 카탈로그에 담긴 자료를 소개해 주세요."
							/>
						</label>
					</section>

					<section
						className="collection-panel"
						aria-labelledby="collection-items-heading"
					>
						<div className="collection-section-title">
							<h2 id="collection-items-heading">공유 자료</h2>
							<span className="collection-hint">{draft.items.length} / 50</span>
						</div>
						<div className="collection-picker">
							<label className="collection-field">
								추가할 저장소
								<select
									value={addShareId}
									disabled={available.length === 0 || draft.items.length >= 50}
									onChange={(event) => setAddShareId(event.target.value)}
								>
									<option value="">기존 공유 링크 선택</option>
									{available.map((share) => (
										<option key={share.id} value={share.id}>
											{share.owner}/{share.repo}
											{share.showReleases ? " · Releases 포함" : ""}
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
								자료 추가
							</button>
						</div>
						{shares.length === 0 && (
							<p className="collection-hint">
								추가할 수 있는 공유 링크가 없습니다. 저장소 관리에서 먼저 링크를
								만들어 주세요.
							</p>
						)}
						{draft.items.length === 0 && (
							<p className="collection-empty">
								아직 추가한 자료가 없습니다. 위에서 저장소를 선택해 주세요.
							</p>
						)}
						{unavailableCount > 0 && (
							<p className="collection-warning">
								현재 사용할 수 없는 공유 링크가 {unavailableCount}개 있습니다.
								해당 자료를 제거하거나 저장소 관리에서 공유 상태를 확인한 뒤
								다시 불러와 주세요.
							</p>
						)}
						<ol className="collection-edit-items" aria-label="자료 편집">
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
													: "사용할 수 없는 공유 링크"}
											</p>
											<div className="collection-item-actions">
												<button
													type="button"
													className="collection-button collection-button--small"
													aria-label={`${index + 1}번 자료 위로`}
													disabled={index === 0}
													onClick={() => moveItem(index, -1)}
												>
													↑
												</button>
												<button
													type="button"
													className="collection-button collection-button--small"
													aria-label={`${index + 1}번 자료 아래로`}
													disabled={index === draft.items.length - 1}
													onClick={() => moveItem(index, 1)}
												>
													↓
												</button>
												<button
													type="button"
													className="collection-button collection-button--small"
													aria-label={`${index + 1}번 자료 제거`}
													onClick={() =>
														setDraft((current) => ({
															...current,
															items: current.items.filter(
																(_, i) => i !== index,
															),
														}))
													}
												>
													제거
												</button>
											</div>
										</div>
										<label className="collection-field">
											표시 이름 {index + 1}
											<input
												maxLength={100}
												value={item.label}
												onChange={(event) =>
													changeItem(index, { label: event.target.value })
												}
												placeholder={share?.repo || "자료 이름"}
											/>
										</label>
										<label className="collection-field">
											자료 설명 {index + 1}
											<textarea
												rows={2}
												maxLength={300}
												value={item.description}
												onChange={(event) =>
													changeItem(index, { description: event.target.value })
												}
												placeholder="자료의 내용과 용도를 설명해 주세요."
											/>
										</label>
										{share && (
											<p className="collection-hint">
												README 열기
												{share.showReleases ? " · Releases 열기" : ""}
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
								? "저장하지 않은 변경 사항이 있습니다."
								: selected
									? "저장된 내용입니다."
									: "저장하면 공유 주소가 만들어집니다."}
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
								? "처리 중…"
								: selected
									? "변경 사항 저장"
									: "카탈로그 만들기"}
						</button>
					</div>
				</fieldset>
			</form>

			{error && (
				<p
					className="collection-message collection-message--error"
					role="alert"
				>
					{error}
				</p>
			)}
			{notice && (
				<p className="collection-message" role="status">
					{notice}
				</p>
			)}

			{selected && (
				<section
					className="collection-panel collection-share-panel"
					aria-labelledby="collection-share-heading"
				>
					<div className="collection-section-title">
						<h2 id="collection-share-heading">공유 링크</h2>
						<span
							className={`collection-status${selected.enabled ? "" : " collection-status--off"}`}
						>
							{selected.enabled ? "공유 중" : "공유 중지"}
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
						이 주소를 가진 누구나 카탈로그와 연결된 자료를 열람하고 링크를
						재전달할 수 있습니다. 공유 중지는 카탈로그에만 적용되며, 이미 전달한
						개별 저장소 링크는 저장소 관리에서 별도로 중지해야 합니다.
					</p>
					<div className="collection-actions">
						<button
							className="collection-button collection-button--primary"
							type="button"
							disabled={busy}
							onClick={() => void copyLink()}
						>
							링크 복사
						</button>
						<a
							className="collection-button"
							href={collectionPath}
							rel="noreferrer"
							referrerPolicy="no-referrer"
							target="_blank"
						>
							카탈로그 열기 ↗
						</a>
						<button
							className="collection-button collection-button--toggle"
							type="button"
							disabled={busy}
							onClick={() => void persist(!selected.enabled)}
						>
							{selected.enabled ? "공유 중지" : "공유 다시 시작"}
						</button>
					</div>
				</section>
			)}
		</main>
	);
}
