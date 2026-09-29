import { Redis } from "@upstash/redis";

export interface CollectionItem {
	shareId: string;
	label: string;
	description: string;
}

export interface CollectionInput {
	title: string;
	description: string;
	items: CollectionItem[];
}

export interface CollectionRecord extends CollectionInput {
	id: string;
	ownerUserId: number;
	createdAt: number;
	updatedAt: number;
	enabled: boolean;
}

// Content is one JSON hash field, so strings and empty arrays keep their types.
// The enabled field is separate so ordinary content edits cannot undo revocation.
type StoredCollection = Omit<CollectionRecord, keyof CollectionInput> & {
	content: CollectionInput;
};

export class CollectionValidationError extends Error {}

const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCollectionId(value: unknown): value is string {
	return typeof value === "string" && UUID.test(value);
}

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(
	value: unknown,
	name: string,
	max: number,
	required = false,
): string {
	if (value === undefined && !required) return "";
	if (typeof value !== "string" || value.length > max) {
		throw new CollectionValidationError(
			`${name} must be at most ${max} characters`,
		);
	}
	const result = value.trim();
	if (required && !result) {
		throw new CollectionValidationError(`${name} is required`);
	}
	return result;
}

// Parse untrusted JSON without retaining any user-supplied ownership or settings.
export function parseCollectionInput(value: unknown): CollectionInput {
	if (!record(value)) throw new CollectionValidationError("Invalid collection");
	const title = text(value.title, "Title", 120, true);
	const description = text(value.description, "Description", 1000);
	if (!Array.isArray(value.items) || value.items.length > 50) {
		throw new CollectionValidationError(
			"A collection supports at most 50 items",
		);
	}
	const seen = new Set<string>();
	const items = value.items.map((item): CollectionItem => {
		if (!record(item) || !isCollectionId(item.shareId)) {
			throw new CollectionValidationError("Invalid share ID");
		}
		const shareId = item.shareId.toLowerCase();
		if (seen.has(shareId)) {
			throw new CollectionValidationError("Duplicate share ID");
		}
		seen.add(shareId);
		return {
			shareId,
			label: text(item.label, "Item label", 100),
			description: text(item.description, "Item description", 300),
		};
	});
	return { title, description, items };
}

let client: Redis | null = null;

function getRedis(): Redis {
	if (!client) {
		const url =
			process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
		const token =
			process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
		if (!url || !token) {
			throw new Error("KV not configured for collections");
		}
		client = new Redis({ url, token });
	}
	return client;
}

function collectionKey(id: string): string {
	return `collection:${id.toLowerCase()}`;
}

function ownerKey(ownerUserId: number): string {
	if (!Number.isSafeInteger(ownerUserId) || ownerUserId <= 0) {
		throw new CollectionValidationError("Invalid owner");
	}
	return `collections:user:${ownerUserId}`;
}

export async function getCollection(
	id: string,
): Promise<CollectionRecord | null> {
	if (!isCollectionId(id)) return null;
	const stored = await getRedis().hgetall<StoredCollection>(collectionKey(id));
	if (!stored) return null;
	const { content, ...metadata } = stored;
	return { ...content, ...metadata };
}

// Ownership checking and field updates happen in one Redis operation. In
// particular, a delayed content edit never rewrites a stale enabled value.
const UPDATE_COLLECTION = `
if redis.call("HGET", KEYS[1], "ownerUserId") ~= ARGV[1] then
	return 0
end
redis.call("HSET", KEYS[1], "updatedAt", ARGV[2], unpack(ARGV, 3))
return 1
`;

async function updateCollection(
	id: string,
	ownerUserId: number,
	fields: { content?: CollectionInput; enabled?: boolean },
): Promise<CollectionRecord | null> {
	if (!isCollectionId(id)) return null;
	const args: (string | number)[] = [String(ownerUserId), Date.now()];
	for (const [key, value] of Object.entries(fields)) {
		args.push(key, JSON.stringify(value));
	}
	const updated = await getRedis().eval<(string | number)[], number>(
		UPDATE_COLLECTION,
		[collectionKey(id)],
		args,
	);
	return updated === 1 ? getCollection(id) : null;
}

export async function listCollections(
	ownerUserId: number,
): Promise<CollectionRecord[]> {
	const index = ownerKey(ownerUserId);
	const ids = await getRedis().smembers<string[]>(index);
	const records = await Promise.all(ids.map(getCollection));
	return records
		.filter(
			(item): item is CollectionRecord =>
				item !== null && item.ownerUserId === ownerUserId,
		)
		.sort((a, b) => b.updatedAt - a.updatedAt);
}

// Content edits preserve both the URL and the explicit enabled/revoked state.
export async function saveCollection(
	input: CollectionInput,
	ownerUserId: number,
	id?: string,
	enabled?: boolean,
): Promise<CollectionRecord | null> {
	const parsed = parseCollectionInput(input);
	const index = ownerKey(ownerUserId);
	if (enabled !== undefined && typeof enabled !== "boolean") {
		throw new CollectionValidationError("Enabled must be a boolean");
	}
	if (id !== undefined) {
		return updateCollection(id, ownerUserId, {
			content: parsed,
			...(enabled === undefined ? {} : { enabled }),
		});
	}
	const now = Date.now();
	const next: CollectionRecord = {
		...parsed,
		id: globalThis.crypto.randomUUID(),
		ownerUserId,
		createdAt: now,
		updatedAt: now,
		enabled: enabled ?? true,
	};
	const redis = getRedis();
	await redis.hset(collectionKey(next.id), {
		content: parsed,
		id: next.id,
		ownerUserId,
		createdAt: now,
		updatedAt: now,
		enabled: next.enabled,
	});
	await redis.sadd(index, next.id);
	return next;
}

// Revocation is recoverable. It does not delete collections or their share links.
export async function setCollectionEnabled(
	id: string,
	ownerUserId: number,
	enabled: boolean,
): Promise<CollectionRecord | null> {
	ownerKey(ownerUserId);
	if (typeof enabled !== "boolean")
		throw new CollectionValidationError("Enabled must be a boolean");
	return updateCollection(id, ownerUserId, { enabled });
}
