import { NextResponse } from "next/server";
import {
	getInstallationOctokit,
	getInstallationToken,
} from "@/lib/github-app";
import {
	isSafeRepoAssetPath,
	repoImageContentType,
} from "@/lib/repo-asset";
import { resolveShare } from "@/lib/share-store";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REF_LENGTH = 1024;
const MAX_SHARE_ID_LENGTH = 128;

function unavailable(status: number, error: string) {
	return NextResponse.json(
		{ error },
		{
			status,
			headers: { "Cache-Control": "private, no-store, max-age=0" },
		},
	);
}

export async function GET(request: Request) {
	const searchParams = new URL(request.url).searchParams;
	const shareId = searchParams.get("s") ?? "";
	const ref = searchParams.get("ref") ?? "";
	const path = searchParams.get("path") ?? "";

	if (
		!shareId ||
		shareId.length > MAX_SHARE_ID_LENGTH ||
		!ref ||
		ref.length > MAX_REF_LENGTH ||
		ref.includes("\0") ||
		!isSafeRepoAssetPath(path)
	) {
		return unavailable(400, "Invalid asset request");
	}

	const contentType = repoImageContentType(path);
	if (!contentType) {
		return unavailable(415, "Unsupported asset type");
	}

	const target = await resolveShare(shareId);
	if (!target) {
		return unavailable(404, "Link invalid or expired");
	}
	if (target.ref && target.ref !== ref) {
		return unavailable(403, "That branch is not available");
	}

	let file: { name: string; sha: string; size: number };
	try {
		const octokit = getInstallationOctokit(target.installationId);
		const { data } = await octokit.rest.repos.getContent({
			owner: target.owner,
			repo: target.repo,
			path,
			ref,
		});
		if (Array.isArray(data) || data.type !== "file" || !data.sha) {
			return unavailable(404, "Asset not available");
		}
		file = { name: data.name, sha: data.sha, size: data.size };
	} catch (error) {
		const status = (error as { status?: number }).status;
		return unavailable(
			status === 403 || status === 404 ? 404 : 502,
			status === 403 || status === 404
				? "Asset not available"
				: "Asset unavailable",
		);
	}

	if (file.size > MAX_IMAGE_BYTES) {
		return unavailable(413, "Asset is too large");
	}

	let response: Response;
	try {
		const token = await getInstallationToken(target.installationId);
		const owner = encodeURIComponent(target.owner);
		const repo = encodeURIComponent(target.repo);
		const sha = encodeURIComponent(file.sha);
		response = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/vnd.github.raw+json",
					"X-GitHub-Api-Version": "2022-11-28",
					"User-Agent": "github-unlisted",
				},
				redirect: "error",
			},
		);
	} catch {
		return unavailable(502, "Asset unavailable");
	}

	if (!response.ok || !response.body) {
		return unavailable(
			response.status === 403 || response.status === 404 ? 404 : 502,
			response.status === 403 || response.status === 404
				? "Asset not available"
				: "Asset unavailable",
		);
	}

	return new NextResponse(response.body, {
		status: 200,
		headers: {
			"Cache-Control": "private, no-store, max-age=0",
			"Content-Disposition": "inline",
			"Content-Length": String(file.size),
			"Content-Security-Policy": "default-src 'none'; sandbox",
			"Content-Type": contentType,
			"Cross-Origin-Resource-Policy": "same-origin",
			"Referrer-Policy": "no-referrer",
			"X-Content-Type-Options": "nosniff",
			"X-Frame-Options": "DENY",
		},
	});
}
