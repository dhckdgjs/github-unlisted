"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useClientLocalePage, useLocale } from "@/components/locale-provider";
import { NavLinks } from "@/components/nav-links";
import { SiteDrawer } from "@/components/site-drawer";
import { SiteFooter } from "@/components/site-footer";
import { intlLocale, type Locale } from "@/lib/i18n";

interface Repo {
	installationId: number;
	owner: string;
	name: string;
	fullName: string;
	private: boolean;
}
interface Share {
	id: string;
	owner: string;
	repo: string;
	createdAt?: number;
	expiresAt?: number;
	ref?: string;
	showBranches?: boolean;
	allowDownload?: boolean;
	showReleases?: boolean;
}

type VisFilter = "all" | "private" | "public";
type ShareFilter = "all" | "shared" | "unshared";

type Unit = "days" | "weeks" | "months" | "years" | "never";
type TranslatedMessage = [korean: string, english: string];

const SHARE_ERRORS: Record<string, TranslatedMessage> = {
	"Not signed in": ["로그인이 필요합니다", "Not signed in"],
	"Invalid JSON": ["요청 형식이 올바르지 않습니다", "Invalid JSON"],
	"Missing fields": ["필수 정보가 누락되었습니다", "Missing fields"],
	"Missing id": ["공유 링크 ID가 없습니다", "Missing id"],
	Forbidden: ["접근 권한이 없습니다", "Forbidden"],
	"Repo not in this installation": [
		"앱에 접근이 허용된 저장소가 아닙니다",
		"Repo not in this installation",
	],
	"Invalid branch": ["브랜치 형식이 올바르지 않습니다", "Invalid branch"],
	"Unknown branch": ["브랜치를 찾을 수 없습니다", "Unknown branch"],
	"Not found": ["공유 링크를 찾을 수 없습니다", "Not found"],
};

// Months/years use fixed 30d/365d windows, close enough for a revoke timer.
const UNIT_SECONDS: Record<Exclude<Unit, "never">, number> = {
	days: 86400,
	weeks: 604800,
	months: 2592000,
	years: 31536000,
};

interface TtlSel {
	amount: number;
	unit: Unit;
}

function ttlFor(sel: TtlSel): number | null {
	if (sel.unit === "never") return null;
	return Math.max(1, Math.floor(sel.amount)) * UNIT_SECONDS[sel.unit];
}

function until(ts: number, locale: Locale): string {
	const relative = new Intl.RelativeTimeFormat(intlLocale(locale), {
		numeric: "always",
		style: "short",
	});
	const s = Math.floor((ts - Date.now()) / 1000);
	if (s <= 0) return locale === "ko" ? "곧" : "soon";
	const m = s / 60;
	if (m < 60) return relative.format(Math.ceil(m), "minute");
	const h = m / 60;
	if (h < 24) return relative.format(Math.ceil(h), "hour");
	const d = h / 24;
	if (d < 14) return relative.format(Math.ceil(d), "day");
	const w = d / 7;
	if (w < 10) return relative.format(Math.ceil(w), "week");
	const mo = d / 30;
	if (mo < 24) return relative.format(Math.ceil(mo), "month");
	return relative.format(Math.ceil(d / 365), "year");
}

function ago(ts: number | undefined, locale: Locale): string {
	if (!ts) return "";
	const relative = new Intl.RelativeTimeFormat(intlLocale(locale), {
		numeric: "always",
		style: "short",
	});
	const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
	if (s < 60) return locale === "ko" ? "방금" : "just now";
	const m = Math.floor(s / 60);
	if (m < 60) return relative.format(-m, "minute");
	const h = Math.floor(m / 60);
	if (h < 24) return relative.format(-h, "hour");
	const d = Math.floor(h / 24);
	if (d < 7) return relative.format(-d, "day");
	const w = Math.floor(d / 7);
	return relative.format(-w, "week");
}

// Segmented filter control styled like the nav pill bar: a bordered pill
// container whose active option fills with the accent.
function Seg<T extends string>({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: { key: T; label: string }[];
	value: T;
	onChange: (v: T) => void;
}) {
	return (
		<div className="seg" role="tablist" aria-label={label}>
			{options.map((o) => (
				<button
					key={o.key}
					type="button"
					role="tab"
					className="seg__opt"
					aria-selected={value === o.key}
					onClick={() => onChange(o.key)}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}

// Yes/No toggle for the control panel, style cue taken from the viewer's
// markdown Preview/Code tabs: joined bordered buttons, active one filled.
function YesNo({
	label,
	hint,
	value,
	disabled,
	onChange,
}: {
	label: string;
	hint?: string;
	value: boolean;
	disabled?: boolean;
	onChange: (v: boolean) => void;
}) {
	const { t } = useLocale();
	return (
		<div className="dash-ctl">
			<span className="dash-ctl__label">
				{label}
				{hint && (
					<span className="dash-hint" title={hint}>
						?
					</span>
				)}
			</span>
			<div className="yesno" role="tablist" aria-label={label}>
				<button
					type="button"
					role="tab"
					className="yesno__opt"
					aria-selected={value}
					disabled={disabled}
					onClick={() => onChange(true)}
				>
					{t("예", "Yes")}
				</button>
				<button
					type="button"
					role="tab"
					className="yesno__opt"
					aria-selected={!value}
					disabled={disabled}
					onClick={() => onChange(false)}
				>
					{t("아니요", "No")}
				</button>
			</div>
		</div>
	);
}

export function DashboardClient({
	repos,
	shares,
	login,
}: {
	repos: Repo[];
	shares: Share[];
	login: string;
}) {
	const { locale, t } = useLocale();
	useClientLocalePage("저장소 관리", "Dashboard");
	const router = useRouter();
	const [query, setQuery] = React.useState("");
	// Spec defaults: visibility starts on "private" (the repos people
	// actually share), the share filter starts wide open.
	const [visFilter, setVisFilter] = React.useState<VisFilter>("private");
	const [shareFilter, setShareFilter] = React.useState<ShareFilter>("all");
	const [selected, setSelected] = React.useState<string | null>(null);
	const [busy, setBusy] = React.useState(false);
	const [copied, setCopied] = React.useState(false);
	const [error, setError] = React.useState<TranslatedMessage | null>(null);
	const [ttlSel, setTtlSel] = React.useState<Record<string, TtlSel>>({});
	const [swSel, setSwSel] = React.useState<Record<string, boolean>>({});
	const [dlSel, setDlSel] = React.useState<Record<string, boolean>>({});
	const [relSel, setRelSel] = React.useState<Record<string, boolean>>({});

	const shareByRepo = React.useMemo(() => {
		const m = new Map<string, Share>();
		for (const s of shares) m.set(`${s.owner}/${s.repo}`.toLowerCase(), s);
		return m;
	}, [shares]);

	const stats = React.useMemo(() => {
		let shared = 0;
		let pub = 0;
		for (const r of repos) {
			if (shareByRepo.has(r.fullName.toLowerCase())) shared++;
			if (!r.private) pub++;
		}
		const priv = repos.length - pub;
		return { total: repos.length, pub, priv, shared };
	}, [repos, shareByRepo]);

	const visible = repos.filter((r) => {
		const isShared = shareByRepo.has(r.fullName.toLowerCase());
		if (visFilter === "private" && !r.private) return false;
		if (visFilter === "public" && r.private) return false;
		if (shareFilter === "shared" && !isShared) return false;
		if (shareFilter === "unshared" && isShared) return false;
		if (query && !r.fullName.toLowerCase().includes(query.toLowerCase()))
			return false;
		return true;
	});

	const selRepo = repos.find((r) => r.fullName === selected) ?? null;
	const selShare = selRepo
		? shareByRepo.get(selRepo.fullName.toLowerCase())
		: undefined;

	// Panel control values fall back to what is stored on the share, so an
	// existing link shows its real settings before the user touches anything.
	const key = selRepo?.fullName ?? "";
	const ttl = ttlSel[key] ?? { amount: 1, unit: "never" as Unit };
	const dl = dlSel[key] ?? selShare?.allowDownload ?? false;
	const rel = relSel[key] ?? selShare?.showReleases ?? false;
	const sw = swSel[key] ?? selShare?.showBranches ?? false;

	const failure = async (res: Response, fallback: TranslatedMessage) => {
		const data = (await res.json().catch(() => null)) as {
			error?: string;
		} | null;
		setError(
			data?.error
				? Object.hasOwn(SHARE_ERRORS, data.error)
					? SHARE_ERRORS[data.error]
					: [data.error, data.error]
				: fallback,
		);
	};

	const create = async (r: Repo) => {
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/share", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					installationId: r.installationId,
					owner: r.owner,
					repo: r.name,
					ttlSeconds: ttlFor(ttl),
					ref: null,
					showBranches: sw,
					allowDownload: dl,
					showReleases: rel,
				}),
			});
			if (!res.ok) {
				await failure(res, [
					"공유 링크를 만들지 못했습니다",
					"Could not create the link",
				]);
				return;
			}
			router.refresh();
		} catch {
			setError(["공유 링크를 만들지 못했습니다", "Could not create the link"]);
		} finally {
			setBusy(false);
		}
	};

	// One "Set" applies every panel control. ttlSeconds is always sent, so
	// pressing Set restarts the auto-revoke window even when only a toggle
	// changed. The stored branch lock (ref) is preserved as-is: the panel
	// has no control for it anymore.
	const applySettings = async (s: Share) => {
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/share", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: s.id,
					ttlSeconds: ttlFor(ttl),
					ref: s.ref ?? null,
					showBranches: sw,
					allowDownload: dl,
					showReleases: rel,
				}),
			});
			if (!res.ok) {
				await failure(res, [
					"공유 링크를 변경하지 못했습니다",
					"Could not update the link",
				]);
				return;
			}
			router.refresh();
		} catch {
			setError([
				"공유 링크를 변경하지 못했습니다",
				"Could not update the link",
			]);
		} finally {
			setBusy(false);
		}
	};

	const revoke = async (s: Share) => {
		if (
			!confirm(
				t(
					`${s.owner}/${s.repo}의 공유 링크를 중지할까요?`,
					`Revoke the link to ${s.owner}/${s.repo}?`,
				),
			)
		)
			return;
		setBusy(true);
		try {
			const res = await fetch(`/api/share?id=${encodeURIComponent(s.id)}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error();
			router.refresh();
		} finally {
			setBusy(false);
		}
	};

	const copy = async (s: Share) => {
		const url = `${window.location.origin}/${s.owner}/${s.repo}?s=${s.id}`;
		await navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	return (
		<div className="page-shell">
			<header className="topbar">
				<a
					className="wordmark"
					href="/"
					aria-label={t("github unlisted 홈", "github unlisted home")}
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

				<NavLinks signedIn={true} active="dashboard" />

				<a className="nav-cta" href="/api/github/logout">
					{t("로그아웃", "Sign Out")}
				</a>

				<SiteDrawer signedIn={true} active="dashboard" />
			</header>

			<main className="dashboard">
				{/* Row 1: welcome */}
				<section className="dash-welcome">
					<p className="dash-welcome__hi">{t("안녕하세요,", "Welcome,")}</p>
					<h1 className="dash-welcome__name">{login}</h1>
				</section>

				{/* Row 2: stats */}
				<section
					className="dash-stats"
					aria-label={t("내 저장소 현황", "Your stats")}
				>
					<div className="dash-stat">
						<span className="dash-stat__label">
							{t("저장소", "Repositories")}
						</span>
						<span className="dash-stat__value">{stats.total}</span>
					</div>
					<div className="dash-stat">
						<span className="dash-stat__label">{t("공개", "Public")}</span>
						<span className="dash-stat__value">{stats.pub}</span>
					</div>
					<div className="dash-stat">
						<span className="dash-stat__label">{t("비공개", "Private")}</span>
						<span className="dash-stat__value">{stats.priv}</span>
					</div>
					<div className="dash-stat">
						<span className="dash-stat__label">{t("공유 중", "Shared")}</span>
						<span className="dash-stat__value">{stats.shared}</span>
					</div>
					<div className="dash-stat">
						<span className="dash-stat__label">
							{t("공유 중/비공개", "Shared/Private")}
						</span>
						<span className="dash-stat__value">
							{stats.shared}/{stats.priv}
						</span>
					</div>
				</section>

				{/* Row 3: search + the two filter toggles */}
				<section className="dash-filters">
					<label className="dash-search">
						<span className="dash-search__icon" aria-hidden="true">
							<svg
								width="15"
								height="15"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<circle cx="11" cy="11" r="7" />
								<line x1="21" y1="21" x2="16.65" y2="16.65" />
							</svg>
						</span>
						<input
							type="search"
							placeholder={t("저장소 검색", "Search repositories")}
							aria-label={t("저장소 검색", "Search repositories")}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
					</label>
					<Seg
						label={t("공개 여부로 필터", "Filter by visibility")}
						options={[
							{ key: "all", label: t("전체", "All") },
							{ key: "private", label: t("비공개", "Private") },
							{ key: "public", label: t("공개", "Public") },
						]}
						value={visFilter}
						onChange={setVisFilter}
					/>
					<Seg
						label={t("공유 상태로 필터", "Filter by share state")}
						options={[
							{ key: "all", label: t("전체", "All") },
							{ key: "shared", label: t("공유 중", "Shared") },
							{ key: "unshared", label: t("공유 안 함", "Unshared") },
						]}
						value={shareFilter}
						onChange={setShareFilter}
					/>
				</section>

				{error && (
					<div className="signin-error" role="alert">
						{t(...error)}
					</div>
				)}

				{/* Row 4: selectable repo rows */}
				<section
					className="dash-repos"
					aria-label={t("저장소", "Repositories")}
				>
					{visible.length === 0 && (
						<p className="dash-repos__empty">
							{t("조건에 맞는 저장소가 없습니다.", "No repositories match.")}
						</p>
					)}
					{visible.map((r) => {
						const share = shareByRepo.get(r.fullName.toLowerCase());
						const isSel = selected === r.fullName;
						return (
							<button
								type="button"
								className="repo-card"
								key={r.fullName}
								aria-pressed={isSel}
								onClick={() => setSelected(isSel ? null : r.fullName)}
							>
								<span className="repo-card__name">{r.name}</span>
								{/* One line: share state left (the meta stats stand in for
								    "shared", since only one of the two can apply), repo
								    visibility pinned to the right. */}
								<span className="repo-card__state">
									{share ? (
										<span className="repo-card__meta">
											{share.createdAt && (
												<span>
													{t(
														`${ago(share.createdAt, locale)} 생성`,
														`created ${ago(share.createdAt, locale)}`,
													)}
												</span>
											)}
											<span>
												{share.expiresAt
													? t(
															`${until(share.expiresAt, locale)} 공유 중지`,
															`revokes ${until(share.expiresAt, locale)}`,
														)
													: t("자동 중지 없음", "no auto-revoke")}
											</span>
											<span>
												{share.ref
													? t(
															`${share.ref} 브랜치로 고정`,
															`locked to ${share.ref}`,
														)
													: share.showBranches
														? t("브랜치 목록 표시", "branch list shown")
														: t("기본 브랜치", "default branch")}
											</span>
											{share.allowDownload && (
												<span>{t("ZIP 다운로드 허용", "zip enabled")}</span>
											)}
											{share.showReleases && (
												<span>{t("릴리스 표시", "releases shown")}</span>
											)}
										</span>
									) : (
										<span>{t("공유 안 함", "unshared")}</span>
									)}
									<span className="repo-card__vis">
										{r.private ? t("비공개", "private") : t("공개", "public")}
									</span>
								</span>
							</button>
						);
					})}
				</section>

				{/* Final row: sticky control panel for the selected repo */}
				<section
					className="dash-panel"
					aria-label={t("공유 설정", "Share controls")}
				>
					{!selRepo ? (
						<p className="dash-panel__hint">
							{t(
								"위에서 저장소를 선택해 공유 링크를 관리하세요.",
								"Select a repository above to manage its share link.",
							)}
						</p>
					) : (
						<>
							<p className="dash-panel__repo">
								{selRepo.name}
								<span className="sep">|</span>
								<span>
									{selShare
										? t("공유 중", "shared")
										: t("공유 안 함", "unshared")}
								</span>
							</p>
							<div className="dash-panel__controls">
								<YesNo
									label={t(
										"저장소 ZIP 다운로드 허용",
										"Viewers can download repo as a zip",
									)}
									value={dl}
									disabled={busy}
									onChange={(v) => setDlSel((p) => ({ ...p, [key]: v }))}
								/>
								<YesNo
									label={t("릴리스도 함께 표시", "Show releases as well")}
									value={rel}
									disabled={busy}
									onChange={(v) => setRelSel((p) => ({ ...p, [key]: v }))}
								/>
								<YesNo
									label={t(
										"브랜치 목록 표시",
										"Let users see a list of branches",
									)}
									hint={t(
										"이 설정과 관계없이 링크는 기본 브랜치를 열며, 열람자는 URL을 수정해 다른 브랜치에 접근할 수 있습니다. 목록은 브랜치 이동을 돕는 기능입니다.",
										"Whatever is selected, the link opens on the default branch, and viewers can always edit the URL to reach another branch. The list just makes it easier.",
									)}
									value={sw}
									disabled={busy}
									onChange={(v) => setSwSel((p) => ({ ...p, [key]: v }))}
								/>
								<div className="dash-ctl">
									<span className="dash-ctl__label">
										{t("공유 링크 자동 중지", "Revoke shared link")}
									</span>
									<span className="ttl">
										<input
											type="number"
											min={1}
											className="ttl__num"
											aria-label={t("자동 중지 기간", "Auto-revoke amount")}
											value={ttl.amount}
											disabled={busy || ttl.unit === "never"}
											onChange={(e) =>
												setTtlSel((p) => ({
													...p,
													[key]: {
														...ttl,
														amount: Math.max(
															1,
															Math.floor(Number(e.target.value) || 1),
														),
													},
												}))
											}
										/>
										<select
											className="ttl__unit"
											aria-label={t("자동 중지 단위", "Auto-revoke unit")}
											value={ttl.unit}
											disabled={busy}
											onChange={(e) =>
												setTtlSel((p) => ({
													...p,
													[key]: { ...ttl, unit: e.target.value as Unit },
												}))
											}
										>
											<option value="days">{t("일", "days")}</option>
											<option value="weeks">{t("주", "weeks")}</option>
											<option value="months">{t("개월", "months")}</option>
											<option value="years">{t("년", "years")}</option>
											<option value="never">
												{t("자동 중지 안 함", "never revoke")}
											</option>
										</select>
									</span>
								</div>
							</div>
							<div className="dash-panel__actions">
								{selShare ? (
									<>
										<button
											type="button"
											className="dash-btn dash-btn--danger"
											disabled={busy}
											onClick={() => revoke(selShare)}
										>
											{busy
												? t("처리 중", "Working")
												: t("공유 중지", "Revoke")}
										</button>
										<button
											type="button"
											className="dash-btn dash-btn--set"
											disabled={busy}
											onClick={() => applySettings(selShare)}
										>
											{t("적용", "Set")}
										</button>
										<button
											type="button"
											className="dash-btn"
											onClick={() => copy(selShare)}
										>
											{copied
												? t("복사됨", "Copied")
												: t("링크 복사", "Copy Link")}
										</button>
										<a
											className="dash-btn"
											href={`/${selRepo.owner}/${selRepo.name}?s=${selShare.id}`}
											target="_blank"
											rel="noopener"
										>
											{t("열기", "Visit")}
										</a>
									</>
								) : (
									<button
										type="button"
										className="dash-btn dash-btn--accent"
										disabled={busy}
										onClick={() => create(selRepo)}
									>
										{busy ? t("만드는 중", "Creating") : t("공유하기", "Share")}
									</button>
								)}
							</div>
						</>
					)}
				</section>
			</main>
			<SiteFooter />
		</div>
	);
}
