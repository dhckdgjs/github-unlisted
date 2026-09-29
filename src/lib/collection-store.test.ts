import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redis = vi.hoisted(() => ({
	hgetall: vi.fn(),
	hset: vi.fn(),
	eval: vi.fn(),
	sadd: vi.fn(),
	smembers: vi.fn(),
	del: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
	Redis: class {
		hgetall = redis.hgetall;
		hset = redis.hset;
		eval = redis.eval;
		sadd = redis.sadd;
		smembers = redis.smembers;
		del = redis.del;
	},
}));

import {
	type CollectionRecord,
	getCollection,
	listCollections,
	parseCollectionInput,
	saveCollection,
	setCollectionEnabled,
} from "./collection-store";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const shareId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const input = {
	title: "Project notes",
	description: "Selected projects",
	items: [{ shareId, label: "Sample", description: "Read the README" }],
};
const collection: CollectionRecord = {
	...input,
	id,
	ownerUserId: 7,
	createdAt: 100,
	updatedAt: 200,
	enabled: true,
};

const hashes = new Map<string, Record<string, unknown>>();
function stored(value: CollectionRecord) {
	const { title, description, items, ...metadata } = value;
	return { ...metadata, content: { title, description, items } };
}

// Model one atomic Redis script invocation without a Redis service or secrets.
function atomicPatch(
	_script: string,
	keys: string[],
	args: (string | number)[],
) {
	const current = hashes.get(keys[0]);
	if (!current || String(current.ownerUserId) !== String(args[0])) return 0;
	const next: Record<string, unknown> = {
		...current,
		updatedAt: Number(args[1]),
	};
	for (let i = 2; i < args.length; i += 2) {
		next[String(args[i])] = JSON.parse(String(args[i + 1]));
	}
	hashes.set(keys[0], next);
	return 1;
}

describe("collection store", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		hashes.clear();
		vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
		vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-only-placeholder");
		redis.hgetall.mockImplementation(
			async (key: string) => hashes.get(key) ?? null,
		);
		redis.hset.mockImplementation(
			async (key: string, value: Record<string, unknown>) =>
				hashes.set(key, { ...hashes.get(key), ...value }),
		);
		redis.eval.mockImplementation(atomicPatch);
		redis.smembers.mockResolvedValue([]);
	});

	afterEach(() => vi.unstubAllEnvs());

	it("validates and normalizes only permitted content fields", () => {
		expect(
			parseCollectionInput({
				...input,
				title: " Notes ",
				ownerUserId: 99,
				installationId: 55,
				items: [{ shareId: shareId.toUpperCase() }],
			}),
		).toEqual({
			title: "Notes",
			description: input.description,
			items: [{ shareId, label: "", description: "" }],
		});
	});

	it.each([
		null,
		[],
		{ ...input, title: " " },
		{ ...input, title: "x".repeat(121) },
		{ ...input, description: "x".repeat(1001) },
		{ ...input, items: new Array(51).fill(input.items[0]) },
		{ ...input, items: [{ shareId: "not-a-uuid" }] },
		{ ...input, items: [{ shareId, label: "x".repeat(101) }] },
		{ ...input, items: [{ shareId, description: "x".repeat(301) }] },
		{ ...input, items: [{ shareId }, { shareId: shareId.toUpperCase() }] },
	])("rejects invalid collection content %j", (value) => {
		expect(() => parseCollectionInput(value)).toThrow();
	});

	it("never sends a malformed collection key to Redis", async () => {
		expect(await getCollection("../secrets")).toBeNull();
		expect(redis.hgetall).not.toHaveBeenCalled();
	});

	it("creates an opaque ID in Redis and indexes it under the owner", async () => {
		const saved = await saveCollection(input, 7);
		expect(saved?.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(saved).toMatchObject({ ...input, ownerUserId: 7, enabled: true });
		expect(await getCollection(saved?.id ?? "")).toEqual(saved);
		expect(redis.sadd).toHaveBeenCalledWith("collections:user:7", saved?.id);
	});

	it("edits the same ID and preserves its creation date and disabled state", async () => {
		hashes.set(`collection:${id}`, stored({ ...collection, enabled: false }));
		const saved = await saveCollection({ ...input, title: "Updated" }, 7, id);
		expect(saved).toMatchObject({
			id,
			createdAt: 100,
			enabled: false,
			title: "Updated",
		});
		expect(redis.eval).toHaveBeenCalledTimes(1);
	});

	it("rejects updates and state changes by another owner", async () => {
		hashes.set(`collection:${id}`, stored(collection));
		expect(await saveCollection(input, 8, id)).toBeNull();
		expect(await setCollectionEnabled(id, 8, false)).toBeNull();
		expect(await getCollection(id)).toEqual(collection);
		expect(redis.hset).not.toHaveBeenCalled();
	});

	it("does not create a replacement ID when the requested collection is missing", async () => {
		expect(await saveCollection(input, 7, id)).toBeNull();
		expect(redis.hset).not.toHaveBeenCalled();
	});

	it("revokes recoverably without deleting either records or shares", async () => {
		hashes.set(`collection:${id}`, stored(collection));
		expect(await setCollectionEnabled(id, 7, false)).toMatchObject({
			...collection,
			enabled: false,
			updatedAt: expect.any(Number),
		});
		expect(redis.del).not.toHaveBeenCalled();
	});

	it("a delayed content edit cannot restore a collection after concurrent revocation", async () => {
		hashes.set(`collection:${id}`, stored(collection));
		let releaseEdit: () => void = () => {};
		const pause = new Promise<void>((resolve) => {
			releaseEdit = resolve;
		});
		redis.eval.mockImplementationOnce(
			async (...args: Parameters<typeof atomicPatch>) => {
				await pause;
				return atomicPatch(...args);
			},
		);
		const edit = saveCollection({ ...input, title: "Updated" }, 7, id);
		await setCollectionEnabled(id, 7, false);
		expect(await getCollection(id)).toMatchObject({ enabled: false });
		releaseEdit();
		expect(await edit).toMatchObject({ id, title: "Updated", enabled: false });
		expect(await getCollection(id)).toMatchObject({ enabled: false });
	});

	it("saves content and an explicit enabled change in a single atomic update", async () => {
		hashes.set(`collection:${id}`, stored(collection));
		expect(
			await saveCollection({ ...input, items: [], title: "123" }, 7, id, false),
		).toMatchObject({ title: "123", items: [], enabled: false });
		expect(redis.eval).toHaveBeenCalledTimes(1);
	});

	it("lists only current owner's records even if an index contains foreign or missing IDs", async () => {
		const other = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
		redis.smembers.mockResolvedValue([
			id,
			other,
			"dddddddd-dddd-4ddd-8ddd-dddddddddddd",
		]);
		hashes.set(`collection:${id}`, stored(collection));
		hashes.set(
			`collection:${other}`,
			stored({ ...collection, id: other, ownerUserId: 8 }),
		);
		expect(await listCollections(7)).toEqual([collection]);
		expect(redis.smembers).toHaveBeenCalledWith("collections:user:7");
		expect(redis.del).not.toHaveBeenCalled();
	});
});
