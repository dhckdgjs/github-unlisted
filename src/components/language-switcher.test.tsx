import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionManager } from "@/components/collection-manager";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LocaleProvider, useLocale } from "@/components/locale-provider";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function Sample() {
	const { t } = useLocale();
	return <p>{t("한국어 화면", "English interface")}</p>;
}

beforeEach(() => {
	vi.clearAllMocks();
	// biome-ignore lint/suspicious/noDocumentCookie: Test the browser preference cookie used by the provider.
	document.cookie = "unlisted_locale=; Max-Age=0; Path=/";
});

describe("language preference", () => {
	it("uses the server locale on the first render and updates html language", () => {
		render(
			<LocaleProvider initialLocale="en">
				<LanguageSwitcher />
				<Sample />
			</LocaleProvider>,
		);
		expect(screen.getByText("English interface")).toBeInTheDocument();
		expect(document.documentElement.lang).toBe("en");
		expect(screen.getByRole("button", { name: "English" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	it("persists only a language preference and refreshes without changing the URL", () => {
		// biome-ignore lint/suspicious/noDocumentCookie: Synthetic unrelated cookie verifies that language changes cannot overwrite sessions.
		document.cookie = "test_auth_session=unchanged; Path=/";
		const url = window.location.href;
		render(
			<LocaleProvider initialLocale="ko">
				<LanguageSwitcher />
				<Sample />
			</LocaleProvider>,
		);
		fireEvent.click(screen.getByRole("button", { name: "English" }));
		expect(screen.getByText("English interface")).toBeInTheDocument();
		expect(document.cookie).toContain("unlisted_locale=en");
		expect(document.cookie).toContain("test_auth_session=unchanged");
		expect(document.documentElement.lang).toBe("en");
		expect(refresh).toHaveBeenCalledOnce();
		expect(window.location.href).toBe(url);
		fireEvent.click(screen.getByRole("button", { name: "한국어" }));
		expect(screen.getByText("한국어 화면")).toBeInTheDocument();
		expect(document.cookie).toContain("unlisted_locale=ko");
		expect(document.documentElement.lang).toBe("ko");
	});

	it("does not refresh when the selected language is clicked again", () => {
		render(
			<LocaleProvider initialLocale="ko">
				<LanguageSwitcher />
			</LocaleProvider>,
		);
		fireEvent.click(screen.getByRole("button", { name: "한국어" }));
		expect(refresh).not.toHaveBeenCalled();
	});

	it("preserves unsaved collection values and raw repository names while switching", () => {
		render(
			<LocaleProvider initialLocale="ko">
				<LanguageSwitcher />
				<CollectionManager
					initialCollections={[]}
					shares={[
						{
							id: "synthetic-share",
							owner: "example",
							repo: "한글-original-repo",
							showReleases: true,
						},
					]}
					login="example-user"
				/>
			</LocaleProvider>,
		);
		fireEvent.change(screen.getByLabelText("제목"), {
			target: { value: "My untouched title" },
		});
		fireEvent.change(screen.getByLabelText("설명"), {
			target: { value: "원본 입력 내용" },
		});
		fireEvent.click(screen.getByRole("button", { name: "English" }));
		expect(
			screen.getByRole("heading", { name: "Manage collections" }),
		).toBeInTheDocument();
		expect(screen.getByLabelText("Title")).toHaveValue("My untouched title");
		expect(screen.getByLabelText("Description")).toHaveValue("원본 입력 내용");
		expect(
			screen.getByRole("option", {
				name: "example/한글-original-repo · Releases included",
			}),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Create collection" }),
		).toBeEnabled();
		expect(refresh).not.toHaveBeenCalled();
		expect(document.title).toBe("Manage collections — Unlisted Repo");
	});
});
