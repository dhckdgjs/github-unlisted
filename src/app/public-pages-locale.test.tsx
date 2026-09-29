import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ locale: "ko" as "ko" | "en" }));
vi.mock("@/lib/locale-server", () => ({ getLocale: async () => mocks.locale }));
vi.mock("@/lib/session", () => ({ getSession: async () => null }));

import PrivacyPage from "./privacy/page";
import StatusPage from "./status/page";

afterEach(cleanup);

describe("public server page languages", () => {
	it.each([
		"ko",
		"en",
	] as Locale[])("preserves the full privacy and sharing disclosure in %s", async (locale) => {
		mocks.locale = locale;
		render(
			<LocaleProvider initialLocale={locale}>
				{await PrivacyPage()}
			</LocaleProvider>,
		);
		const content = screen.getByRole("main").textContent ?? "";
		expect(
			screen.getByRole("heading", {
				level: 1,
				name: locale === "ko" ? "개인정보 및 공유 안내" : "Privacy and sharing",
			}),
		).toBeInTheDocument();
		for (const phrase of locale === "ko"
			? [
					"MST / dhckdgjs",
					"원본 프로젝트의 공개 서비스와는 별개",
					"읽기 전용 GitHub App",
					"GitHub, Vercel, Upstash",
					"종단간 암호화되지 않습니다",
					"Redis",
					"세션 쿠키",
					"이 호스트에만 적용되는 unlisted_locale 쿠키",
					"언어 선택값(ko 또는 en)만 1년간",
					"이 쿠키는 추적용이 아닙니다",
					"요청 메타데이터",
					"운영자가 명시적으로 설정",
					"README뿐 아니라",
					"릴리스 노트와 다운로드",
					"회수할 수 없습니다",
					"GitHub App을 제거",
				]
			: [
					"MST / dhckdgjs",
					"independent of the upstream public service",
					"read-only GitHub App",
					"GitHub, Vercel and Upstash",
					"not end-to-end encrypted",
					"Redis",
					"session cookie",
					"host-only unlisted_locale cookie",
					"language choice (ko or en) for one year",
					"preference cookie is not used for tracking",
					"request metadata",
					"explicitly configured by the operator",
					"not just its README",
					"release notes and downloads",
					"cannot be recalled",
					"remove the GitHub App installation",
				]) {
			expect(content).toContain(phrase);
		}
	});

	it.each([
		"ko",
		"en",
	] as Locale[])("keeps the informational status and provider limitations in %s", async (locale) => {
		mocks.locale = locale;
		render(
			<LocaleProvider initialLocale={locale}>
				{await StatusPage()}
			</LocaleProvider>,
		);
		expect(
			screen.getByRole("heading", {
				level: 1,
				name: locale === "ko" ? "서비스 상태" : "Instance status",
			}),
		).toBeInTheDocument();
		const content = screen.getByRole("main").textContent ?? "";
		expect(content).toContain(
			locale === "ko"
				? "가동 상태를 자동으로 모니터링하지 않습니다"
				: "not an automated uptime monitor",
		);
		expect(content).toContain(
			locale === "ko" ? "만료 또는 폐기" : "expired, been revoked",
		);
		expect(content).toContain(
			locale === "ko"
				? "원본 프로젝트의 장애 이력은 이 배포의 상태를 나타내지 않습니다"
				: "The upstream project's incident history does not describe this deployment",
		);
	});
});
