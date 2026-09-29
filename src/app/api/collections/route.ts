import { NextResponse } from "next/server";
import {
	CollectionAccessError,
	validateCollectionShares,
} from "@/lib/collection-service";
import {
	CollectionValidationError,
	getCollection,
	isCollectionId,
	listCollections,
	parseCollectionInput,
	saveCollection,
	setCollectionEnabled,
} from "@/lib/collection-store";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
	return NextResponse.json(body, {
		status,
		headers: { "Cache-Control": "private, no-store" },
	});
}

function sameOrigin(request: Request): boolean {
	const origin = request.headers.get("origin");
	return origin !== null && origin === new URL(request.url).origin;
}

function failure(error: unknown) {
	if (error instanceof CollectionValidationError)
		return json({ error: error.message }, 400);
	if (error instanceof CollectionAccessError)
		return json({ error: error.message }, error.status);
	return json({ error: "Collection service is unavailable" }, 503);
}

async function body(request: Request): Promise<Record<string, unknown>> {
	let value: unknown;
	try {
		value = await request.json();
	} catch {
		throw new CollectionValidationError("Invalid JSON");
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new CollectionValidationError("Invalid collection");
	}
	return value as Record<string, unknown>;
}

export async function GET() {
	const session = await getSession();
	if (!session) return json({ error: "Not signed in" }, 401);
	try {
		return json({ collections: await listCollections(session.userId) });
	} catch (error) {
		return failure(error);
	}
}

export async function POST(request: Request) {
	const session = await getSession();
	if (!session) return json({ error: "Not signed in" }, 401);
	if (!sameOrigin(request))
		return json({ error: "Invalid request origin" }, 403);
	try {
		const input = parseCollectionInput(await body(request));
		await validateCollectionShares(input, session);
		return json(
			{ collection: await saveCollection(input, session.userId) },
			201,
		);
	} catch (error) {
		return failure(error);
	}
}

export async function PATCH(request: Request) {
	const session = await getSession();
	if (!session) return json({ error: "Not signed in" }, 401);
	if (!sameOrigin(request))
		return json({ error: "Invalid request origin" }, 403);
	try {
		const patch = await body(request);
		if (!isCollectionId(patch.id))
			throw new CollectionValidationError("Invalid collection ID");
		if ("enabled" in patch && typeof patch.enabled !== "boolean") {
			throw new CollectionValidationError("Enabled must be a boolean");
		}
		const current = await getCollection(patch.id);
		if (!current || current.ownerUserId !== session.userId)
			return json({ error: "Not found" }, 404);
		const contentChanged = ["title", "description", "items"].some(
			(key) => key in patch,
		);
		if (!contentChanged && !("enabled" in patch))
			throw new CollectionValidationError("No changes provided");
		const input = parseCollectionInput({
			title: "title" in patch ? patch.title : current.title,
			description:
				"description" in patch ? patch.description : current.description,
			items: "items" in patch ? patch.items : current.items,
		});
		// An owner can always disable a collection, including after a share expires.
		// Publishing/restoring and content edits verify every submitted share.
		if (contentChanged || patch.enabled === true)
			await validateCollectionShares(input, session);
		const collection = contentChanged
			? await saveCollection(
					input,
					session.userId,
					current.id,
					typeof patch.enabled === "boolean" ? patch.enabled : undefined,
				)
			: await setCollectionEnabled(
					current.id,
					session.userId,
					patch.enabled as boolean,
				);
		if (!collection) return json({ error: "Not found" }, 404);
		return json({ collection });
	} catch (error) {
		return failure(error);
	}
}
