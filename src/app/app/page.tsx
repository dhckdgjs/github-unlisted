import "@/styles/global.css";
import "@/styles/dashboard.css";
import { DashboardClient } from "@/components/dashboard-client";
import { SiteFooter } from "@/components/site-footer";
import { listInstallationRepos } from "@/lib/github-app";
import { translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { pageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/session";
import { listSharesForInstallation } from "@/lib/share-store";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
	const t = translator(await getLocale());
	return pageMetadata({
		title: t("저장소 관리", "Dashboard"),
		path: "/app",
		index: false,
	});
}

const APP_SLUG = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;

function signInError(
	message: string,
	t: ReturnType<typeof translator>,
): string {
	switch (message) {
		case "Invalid OAuth state":
			return t(
				"로그인 요청을 확인할 수 없습니다. 다시 로그인해 주세요.",
				message,
			);
		case "Missing authorization code":
			return t("인증 코드가 없습니다. 다시 로그인해 주세요.", message);
		case "Could not complete GitHub sign-in":
			return t("GitHub 로그인을 완료하지 못했습니다.", message);
		case "Could not verify your GitHub installations":
			return t("GitHub 앱 설치 정보를 확인하지 못했습니다.", message);
		default:
			return message;
	}
}

export default async function AppPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const t = translator(await getLocale());
	const sp = await searchParams;
	const session = await getSession();

	if (!session) {
		const installUrl = APP_SLUG
			? `https://github.com/apps/${APP_SLUG}/installations/new`
			: null;
		return (
			<div className="page-shell">
				<main className="signin-screen">
					<h1>
						{t("로그인하고 공유 링크를 만드세요", "Sign in to create a link")}
					</h1>
					{sp.error && (
						<p className="signin-error">{signInError(String(sp.error), t)}</p>
					)}
					{sp.needs_install && (
						<p className="signin-note">
							{t(
								"로그인했지만 아직 앱이 설치된 저장소가 없습니다. 앱을 설치하고 공유할 저장소를 선택하세요.",
								"You're signed in but the app isn't installed on any repos yet. Install it and pick the repos to share.",
							)}
						</p>
					)}
					<a className="btn btn--accent" href="/api/github/login">
						{t("GitHub 로그인", "Sign in with GitHub")}
					</a>
					{installUrl && (
						<a className="signin-alt" href={installUrl}>
							{t(
								"저장소에 앱 설치하기",
								"Or install the app on your repositories",
							)}
						</a>
					)}
				</main>
				<SiteFooter />
			</div>
		);
	}

	let repos: {
		installationId: number;
		owner: string;
		name: string;
		fullName: string;
		private: boolean;
	}[] = [];
	let loadError: string | null = null;
	try {
		const lists = await Promise.all(
			session.installationIds.map(async (id) =>
				(await listInstallationRepos(id)).map((r) => ({
					installationId: id,
					owner: r.owner,
					name: r.name,
					fullName: r.fullName,
					private: r.private,
				})),
			),
		);
		const seen = new Set<string>();
		repos = lists.flat().filter((r) => {
			if (seen.has(r.fullName)) return false;
			seen.add(r.fullName);
			return true;
		});
	} catch (e) {
		loadError =
			e instanceof Error
				? e.message
				: t("저장소를 불러오지 못했습니다", "Failed to load repositories");
	}

	let shares: {
		id: string;
		owner: string;
		repo: string;
		createdAt?: number;
		expiresAt?: number;
		ref?: string;
		showBranches?: boolean;
		allowDownload?: boolean;
		showReleases?: boolean;
	}[] = [];
	try {
		const lists = await Promise.all(
			session.installationIds.map((id) => listSharesForInstallation(id)),
		);
		shares = lists.flat().map((s) => ({
			id: s.id,
			owner: s.owner,
			repo: s.repo,
			createdAt: s.createdAt,
			expiresAt: s.expiresAt,
			ref: s.ref,
			showBranches: s.showBranches,
			allowDownload: s.allowDownload,
			showReleases: s.showReleases,
		}));
	} catch {
		// Non-fatal.
	}

	if (loadError) {
		return (
			<div className="page-shell">
				<main className="signin-screen">
					<h1>
						{t("저장소를 불러오지 못했습니다", "Couldn't load repositories")}
					</h1>
					<p className="signin-error">{loadError}</p>
					<a className="btn btn--ghost btn--sm" href="/api/github/logout">
						{t("로그아웃", "Sign out")}
					</a>
				</main>
				<SiteFooter />
			</div>
		);
	}

	return (
		<DashboardClient repos={repos} shares={shares} login={session.login} />
	);
}
