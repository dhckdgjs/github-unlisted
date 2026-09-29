import { beforeEach, describe, expect, it, vi } from "vitest";
import { intlLocale, normalizeLocale, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";

const { cookieValue } = vi.hoisted(() => ({ cookieValue: vi.fn() }));
vi.mock("next/headers", () => ({
	cookies: async () => ({ get: cookieValue }),
}));

beforeEach(() => cookieValue.mockReset());

describe("server language preference", () => {
	it("defaults to Korean without a cookie", async () => {
		expect(await getLocale()).toBe("ko");
		expect(cookieValue).toHaveBeenCalledWith("unlisted_locale");
	});
	it("retains English across server-rendered page loads", async () => {
		cookieValue.mockReturnValue({ value: "en" });
		expect(await getLocale()).toBe("en");
	});
	it("ignores invalid preference values", async () => {
		cookieValue.mockReturnValue({ value: "<script>" });
		expect(await getLocale()).toBe("ko");
		expect(normalizeLocale(null)).toBe("ko");
	});
	it("selects only supplied interface copy and formatting locales", () => {
		expect(translator("ko")("한국어", "English")).toBe("한국어");
		expect(translator("en")("한국어", "English")).toBe("English");
		expect(intlLocale("ko")).toBe("ko-KR");
		expect(intlLocale("en")).toBe("en-US");
	});
});
