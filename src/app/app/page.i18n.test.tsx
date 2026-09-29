import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	getLocale,
	getSession,
	listInstallationRepos,
	listSharesForInstallation,
} = vi.hoisted(() => ({
	getLocale: vi.fn(),
	getSession: vi.fn(),
	listInstallationRepos: vi.fn(),
	listSharesForInstallation: vi.fn(),
}));
vi.mock("@/lib/locale-server", () => ({ getLocale }));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("@/lib/github-app", () => ({ listInstallationRepos }));
vi.mock("@/lib/share-store", () => ({ listSharesForInstallation }));
vi.mock("@/components/dashboard-client", () => ({
	DashboardClient: () => null,
}));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));

import AppPage, { generateMetadata } from "./page";

beforeEach(() => vi.resetAllMocks());

describe("Dashboard server language", () => {
	it.each([
		"ko",
		"en",
	] as const)("localizes known authentication errors in %s", async (locale) => {
		getLocale.mockResolvedValue(locale);
		getSession.mockResolvedValue(null);
		render(
			await AppPage({
				searchParams: Promise.resolve({
					error: "Could not complete GitHub sign-in",
				}),
			}),
		);
		expect(
			screen.getByText(
				locale === "ko"
					? "GitHub 로그인을 완료하지 못했습니다."
					: "Could not complete GitHub sign-in",
			),
		).toBeInTheDocument();
	});

	it.each([
		"ko",
		"en",
	] as const)("localizes sign-in and installation help in %s", async (locale) => {
		getLocale.mockResolvedValue(locale);
		getSession.mockResolvedValue(null);
		render(
			await AppPage({ searchParams: Promise.resolve({ needs_install: "1" }) }),
		);
		expect(
			screen.getByRole("heading", {
				name:
					locale === "ko"
						? "로그인하고 공유 링크를 만드세요"
						: "Sign in to create a link",
			}),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", {
				name: locale === "ko" ? "GitHub 로그인" : "Sign in with GitHub",
			}),
		).toHaveAttribute("href", "/api/github/login");
		expect(
			screen.getByText(
				locale === "ko"
					? /아직 앱이 설치된 저장소가 없습니다/
					: /the app isn't installed on any repos yet/,
			),
		).toBeInTheDocument();
		expect(listInstallationRepos).not.toHaveBeenCalled();
	});

	it.each([
		"ko",
		"en",
	] as const)("localizes error fallback and metadata in %s", async (locale) => {
		getLocale.mockResolvedValue(locale);
		getSession.mockResolvedValue({ login: "example", installationIds: [42] });
		listInstallationRepos.mockRejectedValue(null);
		listSharesForInstallation.mockResolvedValue([]);
		render(await AppPage({ searchParams: Promise.resolve({}) }));
		expect(
			screen.getByRole("heading", {
				name:
					locale === "ko"
						? "저장소를 불러오지 못했습니다"
						: "Couldn't load repositories",
			}),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", {
				name: locale === "ko" ? "로그아웃" : "Sign out",
			}),
		).toHaveAttribute("href", "/api/github/logout");
		expect(await generateMetadata()).toMatchObject({
			title: locale === "ko" ? "저장소 관리" : "Dashboard",
			robots: { index: false, follow: false },
		});
	});
});
