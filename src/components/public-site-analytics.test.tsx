import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	pathname: "/",
	analytics: vi.fn(() => null),
}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@vercel/analytics/next", () => ({ Analytics: mocks.analytics }));
import {
	isPublicAnalyticsUrl,
	PublicSiteAnalytics,
} from "./public-site-analytics";

beforeEach(() => {
	mocks.analytics.mockClear();
});
describe("public-only analytics", () => {
	it("never mounts telemetry on a collection, viewer or dashboard", () => {
		for (const pathname of [
			"/collections/private-id",
			"/app",
			"/app/collections",
			"/owner/repo",
		]) {
			mocks.pathname = pathname;
			const ui = render(<PublicSiteAnalytics />);
			expect(mocks.analytics).not.toHaveBeenCalled();
			ui.unmount();
		}
	});
	it("filters private URLs even after navigation from the public home", () => {
		for (const url of [
			"https://example.test/collections/private-id",
			"/owner/repo?s=private",
			"/?s=private",
			"/faq?token=private",
			"/app",
			"/#private",
		]) {
			expect(isPublicAnalyticsUrl(url)).toBe(false);
		}
		for (const url of [
			"/",
			"/faq",
			"https://example.test/privacy",
			"/status",
		]) {
			expect(isPublicAnalyticsUrl(url)).toBe(true);
		}
	});
});
