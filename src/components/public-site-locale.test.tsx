import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/lib/i18n";
import { ContactButton } from "./contact-button";
import { FaqAccordion } from "./faq-accordion";
import { LocaleProvider, useLocale } from "./locale-provider";
import { NavLinks } from "./nav-links";
import { SiteDrawer } from "./site-drawer";
import { SiteFooter } from "./site-footer";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function SwitchLanguage() {
	const { locale, setLocale } = useLocale();
	return (
		<button
			type="button"
			onClick={() => setLocale(locale === "ko" ? "en" : "ko")}
		>
			Switch test language
		</button>
	);
}

describe("public site languages", () => {
	it.each([
		"ko",
		"en",
	] as Locale[])("keeps navigation destinations and sign-in visibility in %s", (locale) => {
		render(
			<LocaleProvider initialLocale={locale}>
				<NavLinks signedIn={false} />
				<SiteFooter />
			</LocaleProvider>,
		);
		expect(
			screen.getByRole("link", { name: locale === "ko" ? "홈" : "HOME" }),
		).toHaveAttribute("href", "/");
		expect(
			screen.queryByRole("link", { name: /저장소 관리|DASHBOARD/ }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: /공유 목록 관리|COLLECTIONS/ }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /소스 코드|Source Code/ }),
		).toHaveAttribute("href", "https://github.com/dhckdgjs/github-unlisted");
		expect(screen.getByRole("link", { name: /Rév/ })).toHaveAttribute(
			"href",
			"https://www.revoconner.com",
		);
	});

	it("updates the desktop and open mobile navigation together without changing links", () => {
		render(
			<LocaleProvider initialLocale="ko">
				<SwitchLanguage />
				<NavLinks signedIn />
				<SiteDrawer signedIn />
			</LocaleProvider>,
		);
		fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));
		expect(
			screen.getAllByRole("link", { name: "공유 목록 관리" }),
		).toHaveLength(2);
		fireEvent.click(
			screen.getByRole("button", { name: "Switch test language" }),
		);
		for (const link of screen.getAllByRole("link", { name: /collections/i })) {
			expect(link).toHaveAttribute("href", "/app/collections");
		}
		expect(
			screen.getByRole("dialog", { name: "Site navigation" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Sign out" })).toHaveAttribute(
			"href",
			"/api/github/logout",
		);
	});

	it("translates all FAQ answers while retaining the open question", () => {
		render(
			<LocaleProvider initialLocale="ko">
				<SwitchLanguage />
				<FaqAccordion />
			</LocaleProvider>,
		);
		fireEvent.click(
			screen.getByRole("button", {
				name: "공유 링크로 어떤 내용을 볼 수 있나요?",
			}),
		);
		expect(
			screen.getByText(/README뿐 아니라 저장소의 파일 탐색기/),
		).toBeInTheDocument();
		expect(
			screen.getByText(/이미 다운로드한 사본은 회수할 수 없습니다/),
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole("button", { name: "Switch test language" }),
		);
		expect(
			screen.getByRole("button", { name: "What does a share link expose?" }),
		).toHaveAttribute("aria-expanded", "true");
		expect(
			screen.getByText(/The repository file browser, not just the README/),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Copies already downloaded cannot be recalled/),
		).toBeInTheDocument();
		expect(
			screen.getByText(/MST \/ dhckdgjs operates this self-hosted fork/),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Read-only Contents and Metadata/),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				/Repository content passes through GitHub and the hosting service/,
			),
		).toBeInTheDocument();
	});

	it("translates contact errors without changing the request or entered content", async () => {
		const fetch = vi.fn().mockResolvedValue({
			ok: false,
			json: async () => ({ ok: false, error: "Email is not configured." }),
		});
		vi.stubGlobal("fetch", fetch);
		render(
			<LocaleProvider initialLocale="ko">
				<SwitchLanguage />
				<ContactButton />
			</LocaleProvider>,
		);
		fireEvent.click(screen.getByRole("button", { name: "문의하기" }));
		fireEvent.change(screen.getByLabelText("이름"), {
			target: { value: "예시 사용자" },
		});
		fireEvent.change(screen.getByLabelText("이메일"), {
			target: { value: "sample@example.test" },
		});
		fireEvent.change(screen.getByLabelText("문의 유형"), {
			target: { value: "other" },
		});
		fireEvent.change(screen.getByLabelText("문의 제목"), {
			target: { value: "문의 예시" },
		});
		fireEvent.change(screen.getByLabelText("문의 내용"), {
			target: { value: "입력한 내용을 유지해 주세요." },
		});
		const form = screen.getByRole("button", { name: "전송" }).closest("form");
		if (!form) throw new Error("Contact form is missing");
		fireEvent.submit(form);
		expect(
			await screen.findByText("이메일 전송이 설정되어 있지 않습니다."),
		).toBeInTheDocument();
		expect(fetch).toHaveBeenCalledTimes(1);
		const [url, request] = fetch.mock.calls[0];
		expect(url).toBe("/api/contact");
		expect(JSON.parse(request.body)).toEqual({
			name: "예시 사용자",
			email: "sample@example.test",
			subject: "other",
			customSubject: "문의 예시",
			message: "입력한 내용을 유지해 주세요.",
			company: "",
		});
		fireEvent.click(
			screen.getByRole("button", { name: "Switch test language" }),
		);
		expect(screen.getByText("Email is not configured.")).toBeInTheDocument();
		expect(screen.getByLabelText("Message")).toHaveValue(
			"입력한 내용을 유지해 주세요.",
		);
		expect(screen.getByLabelText("Subject")).toHaveValue("other");
	});
});
