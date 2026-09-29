const IMAGE_CONTENT_TYPES: Record<string, string> = {
	".avif": "image/avif",
	".gif": "image/gif",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".png": "image/png",
	".webp": "image/webp",
};

const MAX_PATH_LENGTH = 4096;

export interface RepoAssetContext {
	owner: string;
	repo: string;
	ref: string;
	markdownPath: string;
}

function encodePath(value: string): string {
	return value.split("/").map(encodeURIComponent).join("/");
}

function decodeHtmlAttribute(value: string): string {
	const decodeCodePoint = (entity: string, digits: string, radix: number) => {
		const codePoint = Number.parseInt(digits, radix);
		if (
			!Number.isFinite(codePoint) ||
			codePoint < 0 ||
			codePoint > 0x10ffff ||
			(codePoint >= 0xd800 && codePoint <= 0xdfff)
		) {
			return entity;
		}
		return String.fromCodePoint(codePoint);
	};

	return value
		.replace(/&amp;/gi, "&")
		.replace(/&#x([0-9a-f]+);/gi, (entity: string, hex: string) =>
			decodeCodePoint(entity, hex, 16),
		)
		.replace(/&#([0-9]+);/g, (entity: string, decimal: string) =>
			decodeCodePoint(entity, decimal, 10),
		)
		.replace(/&quot;/gi, '"')
		.replace(/&#(?:39|x27);/gi, "'");
}

function decodePath(value: string): string | null {
	try {
		return decodeURIComponent(value);
	} catch {
		return null;
	}
}

function stripPrefixCaseInsensitive(value: string, prefix: string): string | null {
	if (value.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase()) {
		return null;
	}
	return value.slice(prefix.length);
}

export function isSafeRepoAssetPath(path: string): boolean {
	if (
		!path ||
		path.length > MAX_PATH_LENGTH ||
		path.startsWith("/") ||
		path.includes("\0") ||
		path.includes("\\")
	) {
		return false;
	}

	return path
		.split("/")
		.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export function repoImageContentType(path: string): string | null {
	const dot = path.lastIndexOf(".");
	if (dot < 0) return null;
	return IMAGE_CONTENT_TYPES[path.slice(dot).toLowerCase()] ?? null;
}

export function resolveRepoImagePath(
	rawSrc: string,
	context: RepoAssetContext,
): string | null {
	const src = decodeHtmlAttribute(rawSrc.trim());
	if (
		!src ||
		src.startsWith("#") ||
		src.startsWith("data:") ||
		src.startsWith("blob:")
	) {
		return null;
	}

	// GitHub treats a single leading slash in rendered repository Markdown as
	// relative to the repository root. Keep protocol-relative URLs on the normal
	// URL path below so //example.com can never become a repository asset.
	if (src.startsWith("/") && !src.startsWith("//")) {
		const encodedPath = src.slice(1).split(/[?#]/, 1)[0];
		const path = decodePath(encodedPath);
		return path && isSafeRepoAssetPath(path) && repoImageContentType(path)
			? path
			: null;
	}

	const owner = encodeURIComponent(context.owner);
	const repo = encodeURIComponent(context.repo);
	const ref = encodePath(context.ref);
	const markdownPath = encodePath(context.markdownPath);

	let url: URL;
	try {
		url = new URL(
			src,
			`https://github.com/${owner}/${repo}/blob/${ref}/${markdownPath}`,
		);
	} catch {
		return null;
	}

	if (
		url.protocol !== "https:" ||
		url.port !== "" ||
		url.username !== "" ||
		url.password !== ""
	) {
		return null;
	}

	let encodedPath: string | null = null;
	if (url.hostname === "github.com") {
		const repoPrefix = `/${owner}/${repo}/`;
		const afterRepo = stripPrefixCaseInsensitive(url.pathname, repoPrefix);
		if (afterRepo === null) return null;

		for (const prefix of [
			`blob/${ref}/`,
			`raw/${ref}/`,
			`raw/refs/heads/${ref}/`,
		]) {
			if (afterRepo.startsWith(prefix)) {
				encodedPath = afterRepo.slice(prefix.length);
				break;
			}
		}
	} else if (url.hostname === "raw.githubusercontent.com") {
		const repoPrefix = `/${owner}/${repo}/`;
		const afterRepo = stripPrefixCaseInsensitive(url.pathname, repoPrefix);
		if (afterRepo === null || !afterRepo.startsWith(`${ref}/`)) return null;
		encodedPath = afterRepo.slice(ref.length + 1);
	} else {
		return null;
	}

	if (encodedPath === null) return null;
	const path = decodePath(encodedPath);
	if (!path || !isSafeRepoAssetPath(path) || !repoImageContentType(path)) {
		return null;
	}
	return path;
}

export function buildRepoAssetUrl(
	path: string,
	ref: string,
	shareId: string,
): string {
	const params = new URLSearchParams({ path, ref, s: shareId });
	return `/api/asset?${params.toString()}`;
}

export function rewriteRepoImageSources(
	html: string,
	context: RepoAssetContext,
	shareId: string,
): string {
	const rewriteUrl = (rawSrc: string) => {
		const path = resolveRepoImagePath(rawSrc, context);
		if (!path) return null;
		return buildRepoAssetUrl(path, context.ref, shareId).replace(/&/g, "&amp;");
	};

	const images = html.replace(
		/(<img\b[^>]*?\ssrc\s*=\s*)(["'])([^"']+)\2/gi,
		(match, prefix: string, quote: string, rawSrc: string) => {
			const src = rewriteUrl(rawSrc);
			if (!src) return match;
			return `${prefix}${quote}${src}${quote}`;
		},
	);

	// GitHub's sanitizer preserves <picture><source srcset="…"> and currently
	// reduces each source to one URL. Supporting a single optional descriptor
	// also keeps this safe if that renderer behavior changes.
	return images.replace(
		/(<source\b[^>]*?\ssrcset\s*=\s*)(["'])([^"']+)\2/gi,
		(match, prefix: string, quote: string, rawSrcset: string) => {
			const candidate = /^(\s*)(\S+)(\s+(?:\d+(?:\.\d+)?x|\d+w)\s*)?$/.exec(
				rawSrcset,
			);
			if (!candidate) return match;
			const src = rewriteUrl(candidate[2]);
			if (!src) return match;
			return `${prefix}${quote}${candidate[1]}${src}${candidate[3] ?? ""}${quote}`;
		},
	);
}
