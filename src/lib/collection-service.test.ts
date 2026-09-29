import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getCollection: vi.fn(),
	resolveShare: vi.fn(),
	listInstallationRepos: vi.fn(),
}));
vi.mock("@/lib/collection-store", () => ({
	getCollection: mocks.getCollection,
}));
vi.mock("@/lib/share-store", () => ({ resolveShare: mocks.resolveShare }));
vi.mock("@/lib/github-app", () => ({
	listInstallationRepos: mocks.listInstallationRepos,
}));

import {
	getPublicCollection,
	validateCollectionShares,
} from "./collection-service";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const shareId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const input = {
	title: "Project notes",
	description: "Selected projects",
	items: [{ shareId, label: "Sample", description: "Read the README" }],
};
const record = {
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
const share = {
	installationId: 42,
	owner: "example",
	repo: "sample",
	showReleases: true,
};

describe("collection service", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.getCollection.mockResolvedValue(record);
		mocks.resolveShare.mockResolvedValue(share);
		mocks.listInstallationRepos.mockResolvedValue([
			{ owner: "example", name: "sample" },
		]);
	});

	it("checks the current grant only once for multiple shares in one installation", async () => {
		await validateCollectionShares(
			{
				...input,
				items: [
					...input.items,
					{ shareId: otherId, label: "Another", description: "" },
				],
			},
			session,
		);
		expect(mocks.listInstallationRepos).toHaveBeenCalledExactlyOnceWith(42);
	});

	it("rejects a share from another user's installation before querying its repos", async () => {
		mocks.resolveShare.mockResolvedValue({ ...share, installationId: 99 });
		await expect(
			validateCollectionShares(input, session),
		).rejects.toMatchObject({ status: 403 });
		expect(mocks.listInstallationRepos).not.toHaveBeenCalled();
	});

	it.each([
		null,
		{ ...share, expiresAt: 1 },
	])("rejects missing and expired shares", async (target) => {
		mocks.resolveShare.mockResolvedValue(target);
		await expect(
			validateCollectionShares(input, session),
		).rejects.toMatchObject({ status: 400 });
		expect(mocks.listInstallationRepos).not.toHaveBeenCalled();
	});

	it("rejects grants revoked since the session was issued", async () => {
		mocks.listInstallationRepos.mockResolvedValue([]);
		await expect(
			validateCollectionShares(input, session),
		).rejects.toMatchObject({ status: 403 });
	});

	it("does not authorize writes when GitHub cannot verify access", async () => {
		mocks.listInstallationRepos.mockRejectedValue(new Error("Unavailable"));
		await expect(
			validateCollectionShares(input, session),
		).rejects.toMatchObject({ status: 503 });
	});

	it.each([
		null,
		{ ...record, enabled: false },
	])("does not resolve shares in missing or disabled public collections", async (collection) => {
		mocks.getCollection.mockResolvedValue(collection);
		expect(await getPublicCollection(id)).toBeNull();
		expect(mocks.resolveShare).not.toHaveBeenCalled();
	});

	it("exposes only the public item fields, with no owner account or installation identifier", async () => {
		expect(await getPublicCollection(id)).toEqual({
			...input,
			id,
			items: [
				{
					...input.items[0],
					owner: "example",
					repo: "sample",
					showReleases: true,
				},
			],
		});
	});

	it("hides missing, expired and revoked items including their stored labels and descriptions", async () => {
		const expired = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
		const revoked = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
		mocks.getCollection.mockResolvedValue({
			...record,
			items: [
				...input.items,
				...[otherId, expired, revoked].map((itemId) => ({
					shareId: itemId,
					label: "Removed repository name",
					description: "Removed private description",
				})),
			],
		});
		mocks.resolveShare.mockImplementation(async (itemId: string) =>
			itemId === otherId
				? null
				: itemId === expired
					? { ...share, expiresAt: 1 }
					: itemId === revoked
						? { ...share, repo: "removed" }
						: share,
		);
		const result = await getPublicCollection(id);
		expect(result?.items).toHaveLength(1);
		expect(JSON.stringify(result)).not.toContain("Removed");
		expect(mocks.listInstallationRepos).toHaveBeenCalledTimes(1);
	});

	it("checks grants afresh on each public read and fails closed on installation errors", async () => {
		expect((await getPublicCollection(id))?.items).toHaveLength(1);
		mocks.listInstallationRepos.mockRejectedValue(
			new Error("Installation removed"),
		);
		expect((await getPublicCollection(id))?.items).toEqual([]);
		expect(mocks.listInstallationRepos).toHaveBeenCalledTimes(2);
	});
});
