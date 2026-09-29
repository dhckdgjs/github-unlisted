import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	getCollection: vi.fn(),
	listCollections: vi.fn(),
	saveCollection: vi.fn(),
	setCollectionEnabled: vi.fn(),
	resolveShare: vi.fn(),
	listInstallationRepos: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/collection-store", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/collection-store")>()),
	getCollection: mocks.getCollection,
	listCollections: mocks.listCollections,
	saveCollection: mocks.saveCollection,
	setCollectionEnabled: mocks.setCollectionEnabled,
}));
vi.mock("@/lib/share-store", () => ({ resolveShare: mocks.resolveShare }));
vi.mock("@/lib/github-app", () => ({
	listInstallationRepos: mocks.listInstallationRepos,
}));

import { GET, PATCH, POST } from "./route";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const shareId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const input = {
	title: "Project notes",
	description: "Selected projects",
	items: [{ shareId, label: "Sample", description: "Read the README" }],
};
const collection = {
	...input,
	id,
	ownerUserId: 7,
	enabled: true,
	createdAt: 100,
	updatedAt: 200,
};
const session = {
	userId: 7,
	login: "example",
	installationIds: [42],
	exp: 9999999999,
};
const share = { installationId: 42, owner: "example", repo: "sample" };

function request(
	method: string,
	value: unknown,
	origin: string | null = "https://unlisted.example",
) {
	return new Request("https://unlisted.example/api/collections", {
		method,
		headers: {
			"Content-Type": "application/json",
			...(origin === null ? {} : { Origin: origin }),
		},
		body: JSON.stringify(value),
	});
}

describe("/api/collections", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.getSession.mockResolvedValue(session);
		mocks.getCollection.mockResolvedValue(collection);
		mocks.listCollections.mockResolvedValue([collection]);
		mocks.saveCollection.mockResolvedValue(collection);
		mocks.setCollectionEnabled.mockResolvedValue({
			...collection,
			enabled: false,
		});
		mocks.resolveShare.mockResolvedValue(share);
		mocks.listInstallationRepos.mockResolvedValue([
			{ owner: "example", name: "sample" },
		]);
	});

	it("requires a session for every method", async () => {
		mocks.getSession.mockResolvedValue(null);
		expect((await GET()).status).toBe(401);
		expect((await POST(request("POST", input))).status).toBe(401);
		expect((await PATCH(request("PATCH", { id, enabled: false }))).status).toBe(
			401,
		);
		expect(mocks.listCollections).not.toHaveBeenCalled();
		expect(mocks.saveCollection).not.toHaveBeenCalled();
		expect(mocks.setCollectionEnabled).not.toHaveBeenCalled();
	});

	it("lists only the signed-in user's collections and prohibits caching", async () => {
		const response = await GET();
		expect(await response.json()).toEqual({ collections: [collection] });
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(mocks.listCollections).toHaveBeenCalledExactlyOnceWith(7);
	});

	it.each([
		null,
		"null",
		"https://attacker.example",
		"https://unlisted.example.attacker.example",
	])("rejects absent or cross-origin mutation origins: %s", async (origin) => {
		expect((await POST(request("POST", input, origin))).status).toBe(403);
		expect(
			(await PATCH(request("PATCH", { id, enabled: false }, origin))).status,
		).toBe(403);
		expect(mocks.saveCollection).not.toHaveBeenCalled();
		expect(mocks.getCollection).not.toHaveBeenCalled();
	});

	it("creates only validated content under the session owner", async () => {
		const response = await POST(
			request("POST", { ...input, ownerUserId: 99, installationId: 99 }),
		);
		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ collection });
		expect(mocks.saveCollection).toHaveBeenCalledExactlyOnceWith(input, 7);
		expect(mocks.listInstallationRepos).toHaveBeenCalledExactlyOnceWith(42);
	});

	it.each([
		null,
		[],
		{ ...input, items: [{ shareId: "invalid" }] },
		{ ...input, items: [...input.items, ...input.items] },
	])("rejects malformed request bodies before resolving shares", async (value) => {
		expect((await POST(request("POST", value))).status).toBe(400);
		expect(mocks.resolveShare).not.toHaveBeenCalled();
		expect(mocks.saveCollection).not.toHaveBeenCalled();
	});

	it("rejects invalid JSON", async () => {
		const response = await POST(
			new Request("https://unlisted.example/api/collections", {
				method: "POST",
				headers: { Origin: "https://unlisted.example" },
				body: "{",
			}),
		);
		expect(response.status).toBe(400);
	});

	it("rejects a share from a different installation", async () => {
		mocks.resolveShare.mockResolvedValue({ ...share, installationId: 99 });
		expect((await POST(request("POST", input))).status).toBe(403);
		expect(mocks.listInstallationRepos).not.toHaveBeenCalled();
		expect(mocks.saveCollection).not.toHaveBeenCalled();
	});

	it("rejects a repository removed from the current installation", async () => {
		mocks.listInstallationRepos.mockResolvedValue([]);
		expect((await POST(request("POST", input))).status).toBe(403);
		expect(mocks.saveCollection).not.toHaveBeenCalled();
	});

	it("fails closed when live repository verification fails", async () => {
		mocks.listInstallationRepos.mockRejectedValue(
			new Error("upstream details should not leak"),
		);
		const response = await POST(request("POST", input));
		expect(response.status).toBe(503);
		expect(JSON.stringify(await response.json())).not.toContain(
			"upstream details",
		);
		expect(mocks.saveCollection).not.toHaveBeenCalled();
	});

	it("rejects expired shares even when the record still exists", async () => {
		mocks.resolveShare.mockResolvedValue({ ...share, expiresAt: 1 });
		expect((await POST(request("POST", input))).status).toBe(400);
		expect(mocks.saveCollection).not.toHaveBeenCalled();
	});

	it("does not let another account edit or disable a collection", async () => {
		mocks.getCollection.mockResolvedValue({ ...collection, ownerUserId: 8 });
		expect(
			(await PATCH(request("PATCH", { id, title: "Changed" }))).status,
		).toBe(404);
		expect((await PATCH(request("PATCH", { id, enabled: false }))).status).toBe(
			404,
		);
		expect(mocks.saveCollection).not.toHaveBeenCalled();
		expect(mocks.setCollectionEnabled).not.toHaveBeenCalled();
	});

	it("updates content with the existing ID after rechecking all shares", async () => {
		const response = await PATCH(
			request("PATCH", { id, title: "Changed", ownerUserId: 8 }),
		);
		expect(response.status).toBe(200);
		expect(mocks.saveCollection).toHaveBeenCalledExactlyOnceWith(
			{ ...input, title: "Changed" },
			7,
			id,
			undefined,
		);
		expect(mocks.listInstallationRepos).toHaveBeenCalledExactlyOnceWith(42);
	});

	it("combines content and enabled patches into one atomic store operation", async () => {
		const response = await PATCH(
			request("PATCH", { id, title: "Changed", enabled: false }),
		);
		expect(response.status).toBe(200);
		expect(mocks.saveCollection).toHaveBeenCalledExactlyOnceWith(
			{ ...input, title: "Changed" },
			7,
			id,
			false,
		);
		expect(mocks.setCollectionEnabled).not.toHaveBeenCalled();
	});

	it("lets the owner disable even if underlying shares are now unavailable", async () => {
		mocks.resolveShare.mockResolvedValue(null);
		const response = await PATCH(request("PATCH", { id, enabled: false }));
		expect(response.status).toBe(200);
		expect(mocks.setCollectionEnabled).toHaveBeenCalledExactlyOnceWith(
			id,
			7,
			false,
		);
		expect(mocks.resolveShare).not.toHaveBeenCalled();
	});

	it("rechecks grants before restoring a disabled collection", async () => {
		mocks.getCollection.mockResolvedValue({ ...collection, enabled: false });
		mocks.listInstallationRepos.mockResolvedValue([]);
		expect((await PATCH(request("PATCH", { id, enabled: true }))).status).toBe(
			403,
		);
		expect(mocks.setCollectionEnabled).not.toHaveBeenCalled();
	});

	it.each([
		{ id: "malformed", enabled: false },
		{ id, enabled: "false" },
		{ id },
		{ id, items: null },
	])("rejects malformed patches", async (value) => {
		expect((await PATCH(request("PATCH", value))).status).toBe(400);
		expect(mocks.saveCollection).not.toHaveBeenCalled();
		expect(mocks.setCollectionEnabled).not.toHaveBeenCalled();
	});
});
