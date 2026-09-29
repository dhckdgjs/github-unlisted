import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getContent: vi.fn(),
	getInstallationOctokit: vi.fn(),
	getInstallationToken: vi.fn(),
	resolveShare: vi.fn(),
}));

vi.mock("@/lib/github-app", () => ({
	getInstallationOctokit: mocks.getInstallationOctokit,
	getInstallationToken: mocks.getInstallationToken,
}));

vi.mock("@/lib/share-store", () => ({
	resolveShare: mocks.resolveShare,
}));

import { GET } from "./route";

function request(params: Record<string, string>) {
	const url = new URL("https://unlisted.example/api/asset");
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return new Request(url);
}

const target = {
	installationId: 42,
	owner: "alice",
	repo: "private-repo",
};

describe("GET /api/asset", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		mocks.getContent.mockReset();
		mocks.getInstallationOctokit.mockReset();
		mocks.getInstallationToken.mockReset();
		mocks.resolveShare.mockReset();
		mocks.getInstallationOctokit.mockReturnValue({
			rest: { repos: { getContent: mocks.getContent } },
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("rejects active image formats before resolving the share", async () => {
		const response = await GET(
			request({ s: "share", ref: "main", path: "diagram.svg" }),
		);
		expect(response.status).toBe(415);
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(mocks.resolveShare).not.toHaveBeenCalled();
	});

	it("rejects a branch outside a locked share", async () => {
		mocks.resolveShare.mockResolvedValue({ ...target, ref: "release" });
		const response = await GET(
			request({ s: "share", ref: "main", path: "image.png" }),
		);
		expect(response.status).toBe(403);
		expect(mocks.getInstallationOctokit).not.toHaveBeenCalled();
	});

	it("rejects oversized images before minting a raw-content token", async () => {
		mocks.resolveShare.mockResolvedValue(target);
		mocks.getContent.mockResolvedValue({
			data: {
				name: "image.png",
				sha: "abc123",
				size: 10 * 1024 * 1024 + 1,
				type: "file",
			},
		});

		const response = await GET(
			request({ s: "share", ref: "main", path: "image.png" }),
		);
		expect(response.status).toBe(413);
		expect(mocks.getInstallationToken).not.toHaveBeenCalled();
	});

	it("streams a verified raster blob with defensive response headers", async () => {
		mocks.resolveShare.mockResolvedValue(target);
		mocks.getContent.mockResolvedValue({
			data: { name: "image.png", sha: "abc123", size: 3, type: "file" },
		});
		mocks.getInstallationToken.mockResolvedValue("installation-token");
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
		vi.stubGlobal("fetch", fetchMock);

		const response = await GET(
			request({ s: "share", ref: "main", path: "images/image.png" }),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(
			new Uint8Array([1, 2, 3]),
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.github.com/repos/alice/private-repo/git/blobs/abc123",
			expect.objectContaining({
				redirect: "error",
				headers: expect.objectContaining({
					Authorization: "Bearer installation-token",
				}),
			}),
		);
	});
});
