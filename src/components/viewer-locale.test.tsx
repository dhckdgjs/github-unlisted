import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewerPayload } from "@/lib/viewer-data";
import { LocaleProvider, useLocale } from "./locale-provider";
import { ReleasesList, type RenderedRelease } from "./releases-list";
import { SidebarTree } from "./sidebar-tree";
import { ViewerContent } from "./viewer-content";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
	default: ({ children, href }: { children: React.ReactNode; href: string }) =>
		createElement("a", { href }, children),
}));

function LocaleSwitch() {
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

function withLocale(children: React.ReactNode, locale: "ko" | "en" = "ko") {
	return render(
		<LocaleProvider initialLocale={locale}>
			<LocaleSwitch />
			{children}
		</LocaleProvider>,
	);
}

const filePayload: Extract<ViewerPayload, { kind: "view" }> = {
	kind: "view",
	fullName: "example/sample",
	refName: "feature/raw-name",
	signedIn: false,
	owner: "example",
	repo: "sample",
	shareId: "opaque-share",
	contents: {
		kind: "file",
		name: "README.md",
		text: "# Raw README content",
		isBinary: false,
		size: 42,
	},
	codeHtml: "<pre><code># Raw README content</code></pre>",
	mdHtml: "<h1>Raw README content</h1><p>Preview is source content.</p>",
	fullTree: [{ path: "README.md", type: "file" }],
	sidebarEntries: [],
	crumbs: ["README.md"],
	path: "README.md",
	branches: ["feature/raw-name", "main"],
	showReleases: true,
	allowDownload: true,
};

const release: RenderedRelease = {
	id: 1,
	tag: "v1.0.0-rc.1",
	name: "Original release title",
	body: "Original release notes",
	bodyHtml: "<p>Original release notes</p>",
	prerelease: true,
	publishedUtc: "2026-09-29T23:30:00Z",
	assets: [
		{
			id: 2,
			name: "Original-download.zip",
			size: 1024,
			contentType: "application/zip",
		},
	],
};

describe("viewer localization", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("localStorage", {
			getItem: vi.fn().mockReturnValue(null),
			setItem: vi.fn(),
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("switches viewer controls without modifying content, branch names, URLs, or fetching the repo again", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify(filePayload)));
		vi.stubGlobal("fetch", fetchMock);
		withLocale(
			<ViewerContent slug={["example", "sample"]} shareId="opaque-share" />,
		);

		expect(
			await screen.findByRole("tab", { name: "미리보기" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Raw README content" }),
		).toBeInTheDocument();
		expect(screen.getByText("Preview is source content.")).toBeInTheDocument();
		expect(screen.getByRole("combobox", { name: "브랜치" })).toHaveValue(
			"feature/raw-name",
		);
		expect(screen.getByRole("link", { name: "ZIP 다운로드" })).toHaveAttribute(
			"href",
			"/api/download?s=opaque-share&ref=feature%2Fraw-name",
		);
		expect(screen.getByRole("link", { name: "릴리스" })).toHaveAttribute(
			"href",
			"/example/sample/releases?s=opaque-share",
		);

		fireEvent.click(screen.getByRole("button", { name: "Switch test locale" }));
		expect(screen.getByRole("tab", { name: "Preview" })).toBeInTheDocument();
		expect(screen.getByRole("combobox", { name: "Branch" })).toHaveValue(
			"feature/raw-name",
		);
		expect(
			screen.getByRole("button", { name: "Show file tree" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Soft wrap" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Download as ZIP" }),
		).toHaveAttribute(
			"href",
			"/api/download?s=opaque-share&ref=feature%2Fraw-name",
		);
		expect(screen.getByText("Preview is source content.")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("tab", { name: "Code" }));
		expect(screen.getByText("# Raw README content")).toBeInTheDocument();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("translates known server notices and updates the message when locale changes", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						kind: "notice",
						title: "Link invalid or expired",
						detail:
							"This share link no longer works. Ask the owner for a new one.",
					}),
				),
			),
		);
		withLocale(
			<ViewerContent slug={["example", "sample"]} shareId="opaque-share" />,
		);
		expect(
			await screen.findByRole("heading", {
				name: "유효하지 않거나 만료된 링크입니다",
			}),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "홈" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Switch test locale" }));
		expect(
			screen.getByRole("heading", { name: "Link invalid or expired" }),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"This share link no longer works. Ask the owner for a new one.",
			),
		).toBeInTheDocument();
	});

	it("uses translated error UI when the access check blocks a request", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("", { status: 403 })),
		);
		withLocale(
			<ViewerContent slug={["example", "sample"]} shareId="opaque-share" />,
		);
		expect(
			await screen.findByRole("heading", { name: "접근이 차단되었습니다" }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Switch test locale" }));
		expect(
			screen.getByRole("heading", { name: "Access blocked" }),
		).toBeInTheDocument();
	});

	it("localizes release labels and UTC dates while preserving notes and asset filenames", () => {
		withLocale(<ReleasesList releases={[release]} shareId="opaque-share" />);
		expect(screen.getByText("사전 릴리스")).toBeInTheDocument();
		expect(screen.getByText("Original release notes")).toBeInTheDocument();
		expect(screen.getByTitle("게시일 (UTC)")).toHaveTextContent(
			"2026년 9월 29일",
		);
		expect(
			screen.getByRole("link", { name: "소스 코드 (zip)" }),
		).toHaveAttribute(
			"href",
			"/api/release/download?s=opaque-share&tag=v1.0.0-rc.1",
		);
		fireEvent.click(screen.getByRole("button", { name: "Switch test locale" }));
		expect(screen.getByText("pre-release")).toBeInTheDocument();
		expect(screen.getByTitle("Published (UTC)")).toHaveTextContent(
			"Sep 29, 2026",
		);
		expect(
			screen.getByRole("heading", { name: "Original release title" }),
		).toBeInTheDocument();
		expect(screen.getByText("Original release notes")).toBeInTheDocument();
		expect(
			screen.getByText("Original-download.zip").closest("a"),
		).toHaveAttribute("href", "/api/release/download?s=opaque-share&asset=2");
	});

	it("localizes the fallback file tree and preserves its parent directory link", () => {
		withLocale(
			<SidebarTree
				entries={[]}
				owner="example"
				repo="sample"
				refName="main"
				shareId="opaque-share"
				parentPath="docs"
				showParent
			/>,
		);
		expect(screen.getByRole("link", { name: "상위 폴더" })).toHaveAttribute(
			"href",
			"/example/sample/tree/main/docs?s=opaque-share",
		);
		expect(screen.getByText("파일이 없습니다.")).toBeInTheDocument();
		fireEvent.change(screen.getByRole("searchbox", { name: "파일 검색" }), {
			target: { value: "absent" },
		});
		expect(screen.getByText("검색 결과가 없습니다.")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Switch test locale" }));
		expect(screen.getByRole("searchbox", { name: "Find a file" })).toHaveValue(
			"absent",
		);
		expect(screen.getByText("No matches.")).toBeInTheDocument();
	});
});
