import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider, useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/nav-links", () => ({ NavLinks: () => null }));
vi.mock("@/components/site-drawer", () => ({ SiteDrawer: () => null }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));

import { DashboardClient } from "./dashboard-client";

const now = Date.UTC(2026, 8, 29, 12);
const repos = [
	{
		installationId: 42,
		owner: "example",
		name: "shared-repo",
		fullName: "example/shared-repo",
		private: true,
	},
	{
		installationId: 42,
		owner: "example",
		name: "new-repo",
		fullName: "example/new-repo",
		private: true,
	},
	{
		installationId: 42,
		owner: "example",
		name: "public-repo",
		fullName: "example/public-repo",
		private: false,
	},
];
const shares = [
	{
		id: "existing-share",
		owner: "example",
		repo: "shared-repo",
		createdAt: now - 2 * 60 * 60 * 1000,
		expiresAt: now + 3 * 86400 * 1000,
		ref: "release/한국어",
		showReleases: true,
		allowDownload: true,
	},
];

function SwitchLocale() {
	const { locale, setLocale } = useLocale();
	return (
		<button
			type="button"
			onClick={() => setLocale(locale === "ko" ? "en" : "ko")}
		>
			Switch test locale
		</button>
	);
}

function setup(locale: Locale) {
	return render(
		<LocaleProvider initialLocale={locale}>
			<SwitchLocale />
			<DashboardClient repos={repos} shares={shares} login="example-user" />
		</LocaleProvider>,
	);
}

beforeEach(() => {
	vi.spyOn(Date, "now").mockReturnValue(now);
	refresh.mockClear();
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("DashboardClient language", () => {
	it.each([
		"ko",
		"en",
	] as const)("localizes controls, relative time, and status in %s without changing repo/branch values", (locale) => {
		setup(locale);
		const korean = locale === "ko";
		expect(
			screen.getByText(korean ? "안녕하세요," : "Welcome,"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "example-user" }),
		).toBeInTheDocument();
		expect(
			screen.getByPlaceholderText(
				korean ? "저장소 검색" : "Search repositories",
			),
		).toBeInTheDocument();
		expect(
			screen.getByText(korean ? "2시간 전 생성" : "created 2 hr. ago"),
		).toBeInTheDocument();
		expect(
			screen.getByText(korean ? "3일 후 공유 중지" : "revokes in 3 days"),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				korean ? "release/한국어 브랜치로 고정" : "locked to release/한국어",
			),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /^shared-repo/ }));
		expect(
			screen.getByRole("button", { name: korean ? "공유 중지" : "Revoke" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: korean ? "적용" : "Set" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: korean ? "링크 복사" : "Copy Link" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: korean ? "열기" : "Visit" }),
		).toHaveAttribute("href", "/example/shared-repo?s=existing-share");
		expect(
			screen.getByRole("combobox", {
				name: korean ? "자동 중지 단위" : "Auto-revoke unit",
			}),
		).toHaveValue("never");
		expect(
			screen.getByRole("option", { name: korean ? "개월" : "months" }),
		).toHaveValue("months");
		expect(
			screen.getAllByRole("tab", { name: korean ? "예" : "Yes" }),
		).toHaveLength(3);
	});

	it.each([
		"ko",
		"en",
	] as const)("keeps share creation payload identical in %s", async (locale) => {
		const fetcher = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal("fetch", fetcher);
		setup(locale);
		const korean = locale === "ko";
		fireEvent.click(screen.getByRole("button", { name: /^new-repo/ }));
		fireEvent.change(
			screen.getByRole("combobox", {
				name: korean ? "자동 중지 단위" : "Auto-revoke unit",
			}),
			{ target: { value: "weeks" } },
		);
		fireEvent.change(
			screen.getByRole("spinbutton", {
				name: korean ? "자동 중지 기간" : "Auto-revoke amount",
			}),
			{ target: { value: "2" } },
		);
		fireEvent.click(
			within(
				screen.getByRole("tablist", {
					name: korean ? "릴리스도 함께 표시" : "Show releases as well",
				}),
			).getByRole("tab", { name: korean ? "예" : "Yes" }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: korean ? "공유하기" : "Share" }),
		);
		await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
		expect(fetcher).toHaveBeenCalledWith(
			"/api/share",
			expect.objectContaining({ method: "POST" }),
		);
		expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
			installationId: 42,
			owner: "example",
			repo: "new-repo",
			ttlSeconds: 1209600,
			ref: null,
			showBranches: false,
			allowDownload: false,
			showReleases: true,
		});
	});

	it("preserves selected controls and search input when switching language", () => {
		setup("ko");
		fireEvent.click(screen.getByRole("button", { name: /^new-repo/ }));
		fireEvent.change(screen.getByRole("combobox", { name: "자동 중지 단위" }), {
			target: { value: "days" },
		});
		fireEvent.change(
			screen.getByRole("spinbutton", { name: "자동 중지 기간" }),
			{ target: { value: "7" } },
		);
		fireEvent.change(screen.getByRole("searchbox", { name: "저장소 검색" }), {
			target: { value: "new-repo" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Switch test locale" }));
		expect(
			screen.getByRole("searchbox", { name: "Search repositories" }),
		).toHaveValue("new-repo");
		expect(
			screen.getByRole("spinbutton", { name: "Auto-revoke amount" }),
		).toHaveValue(7);
		expect(
			screen.getByRole("combobox", { name: "Auto-revoke unit" }),
		).toHaveValue("days");
		expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
	});

	it("localizes a failed request again when the user changes language", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		setup("ko");
		fireEvent.click(screen.getByRole("button", { name: /^new-repo/ }));
		fireEvent.click(screen.getByRole("button", { name: "공유하기" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"공유 링크를 만들지 못했습니다",
		);
		fireEvent.click(screen.getByRole("button", { name: "Switch test locale" }));
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Could not create the link",
		);
	});

	it("translates a known API error while preserving the update payload", async () => {
		const fetcher = vi.fn().mockResolvedValue({
			ok: false,
			json: async () => ({ error: "Forbidden" }),
		});
		vi.stubGlobal("fetch", fetcher);
		setup("ko");
		fireEvent.click(screen.getByRole("button", { name: /^shared-repo/ }));
		fireEvent.click(screen.getByRole("button", { name: "적용" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"접근 권한이 없습니다",
		);
		expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
			id: "existing-share",
			ttlSeconds: null,
			ref: "release/한국어",
			showBranches: false,
			allowDownload: true,
			showReleases: true,
		});
	});

	it.each([
		"ko",
		"en",
	] as const)("keeps the revoke confirmation gate in %s", (locale) => {
		const confirm = vi.fn().mockReturnValue(false);
		const fetcher = vi.fn();
		vi.stubGlobal("confirm", confirm);
		vi.stubGlobal("fetch", fetcher);
		setup(locale);
		fireEvent.click(screen.getByRole("button", { name: /^shared-repo/ }));
		fireEvent.click(
			screen.getByRole("button", {
				name: locale === "ko" ? "공유 중지" : "Revoke",
			}),
		);
		expect(confirm).toHaveBeenCalledWith(
			locale === "ko"
				? "example/shared-repo의 공유 링크를 중지할까요?"
				: "Revoke the link to example/shared-repo?",
		);
		expect(fetcher).not.toHaveBeenCalled();
	});
});
