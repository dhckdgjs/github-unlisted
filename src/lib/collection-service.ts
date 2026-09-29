import { type CollectionInput, getCollection } from "@/lib/collection-store";
import { listInstallationRepos } from "@/lib/github-app";
import type { Session } from "@/lib/session";
import { resolveShare, type ShareTarget } from "@/lib/share-store";

export class CollectionAccessError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
	}
}

function active(target: ShareTarget | null): target is ShareTarget {
	return (
		target !== null &&
		(target.expiresAt === undefined || target.expiresAt > Date.now())
	);
}

function repoName(target: ShareTarget): string {
	return `${target.owner}/${target.repo}`.toLowerCase();
}

async function grantedRepos(installationId: number): Promise<Set<string>> {
	const repos = await listInstallationRepos(installationId);
	return new Set(
		repos.map((repo) => `${repo.owner}/${repo.name}`.toLowerCase()),
	);
}

// A session's installation list alone is insufficient: repository grants may
// have changed since login. Check GitHub again once per installation per save.
export async function validateCollectionShares(
	input: CollectionInput,
	session: Session,
): Promise<void> {
	const targets = await Promise.all(
		input.items.map((item) => resolveShare(item.shareId)),
	);
	const installations = new Set<number>();
	for (const target of targets) {
		if (!active(target))
			throw new CollectionAccessError("A share is unavailable or expired", 400);
		if (!session.installationIds.includes(target.installationId)) {
			throw new CollectionAccessError(
				"A share is not owned by your installations",
				403,
			);
		}
		installations.add(target.installationId);
	}
	const grants = new Map<number, Set<string>>();
	try {
		await Promise.all(
			[...installations].map(async (id) =>
				grants.set(id, await grantedRepos(id)),
			),
		);
	} catch {
		throw new CollectionAccessError(
			"Could not verify current repository access",
			503,
		);
	}
	for (const target of targets) {
		if (
			!active(target) ||
			!grants.get(target.installationId)?.has(repoName(target))
		) {
			throw new CollectionAccessError(
				"A share no longer has repository access",
				403,
			);
		}
	}
}

export interface PublicCollection {
	id: string;
	title: string;
	description: string;
	items: {
		shareId: string;
		label: string;
		description: string;
		owner: string;
		repo: string;
		showReleases: boolean;
	}[];
}

// A collection is only an index into existing shares. Every public read checks
// the current grants, and omits the entire entry (including its custom label)
// when a share expires, is revoked, or its installation loses access.
export async function getPublicCollection(
	id: string,
): Promise<PublicCollection | null> {
	const collection = await getCollection(id);
	if (!collection?.enabled) return null;
	const targets = await Promise.all(
		collection.items.map(async (item) => ({
			item,
			target: await resolveShare(item.shareId),
		})),
	);
	const installations = new Set(
		targets.flatMap(({ target }) =>
			active(target) ? [target.installationId] : [],
		),
	);
	const grants = new Map<number, Set<string>>();
	await Promise.all(
		[...installations].map(async (installationId) => {
			try {
				grants.set(installationId, await grantedRepos(installationId));
			} catch {
				// Fail closed on a removed installation or a GitHub outage.
				grants.set(installationId, new Set());
			}
		}),
	);
	return {
		id: collection.id,
		title: collection.title,
		description: collection.description,
		items: targets.flatMap(({ item, target }) => {
			if (
				!active(target) ||
				!grants.get(target.installationId)?.has(repoName(target))
			)
				return [];
			return [
				{
					shareId: item.shareId,
					label: item.label,
					description: item.description,
					owner: target.owner,
					repo: target.repo,
					showReleases: target.showReleases === true,
				},
			];
		}),
	};
}
