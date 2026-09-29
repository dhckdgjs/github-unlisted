import { describe, expect, it } from "vitest";
import {
	buildRepoAssetUrl,
	isSafeRepoAssetPath,
	repoImageContentType,
	resolveRepoImagePath,
	rewriteRepoImageSources,
} from "./repo-asset";

const context = {
	owner: "alice",
	repo: "private-repo",
	ref: "main",
	markdownPath: "README.md",
};

describe("repository image paths", () => {
	it("resolves root and nested relative images", () => {
		expect(resolveRepoImagePath("cover.png", context)).toBe("cover.png");
		expect(resolveRepoImagePath("docs/images/shot.webp", context)).toBe(
			"docs/images/shot.webp",
		);
	});

	it("resolves relative images from a nested README", () => {
		expect(
			resolveRepoImagePath("../images/shot.jpg", {
				...context,
				markdownPath: "docs/README.md",
			}),
		).toBe("images/shot.jpg");
	});

	it("resolves a leading slash from the repository root", () => {
		expect(
			resolveRepoImagePath("/assets/cover.png?raw=1#preview", {
				...context,
				markdownPath: "docs/README.md",
			}),
		).toBe("assets/cover.png");
		expect(resolveRepoImagePath("/../other.png", context)).toBeNull();
		expect(resolveRepoImagePath("//example.com/image.png", context)).toBeNull();
	});

	it("accepts same-repository GitHub and raw URLs", () => {
		expect(
			resolveRepoImagePath(
				"https://github.com/Alice/private-repo/blob/main/images/a.gif",
				context,
			),
		).toBe("images/a.gif");
		expect(
			resolveRepoImagePath(
				"https://raw.githubusercontent.com/alice/private-repo/main/images/a.png",
				context,
			),
		).toBe("images/a.png");
	});

	it("handles slashed branch names and HTML-escaped path characters", () => {
		expect(
			resolveRepoImagePath("images/a&amp;b.png", {
				...context,
				ref: "feature/screenshots",
			}),
		).toBe("images/a&b.png");
	});

	it("rejects external, cross-repository, active, and escaping sources", () => {
		for (const src of [
			"https://example.com/image.png",
			"https://github.com/alice/other/blob/main/image.png",
			"data:image/png;base64,AAAA",
			"blob:https://example.com/id",
			"../../../../image.png",
		]) {
			expect(resolveRepoImagePath(src, context)).toBeNull();
		}
	});

	it("allows only inert raster image types", () => {
		expect(repoImageContentType("a.PNG")).toBe("image/png");
		expect(repoImageContentType("a.jpeg")).toBe("image/jpeg");
		expect(repoImageContentType("a.svg")).toBeNull();
		expect(repoImageContentType("a.html")).toBeNull();
	});

	it("rejects ambiguous repository paths", () => {
		for (const path of ["", "/a.png", "a//b.png", "a/../b.png", "a\\b.png"]) {
			expect(isSafeRepoAssetPath(path)).toBe(false);
		}
		expect(isSafeRepoAssetPath("docs/images/a.png")).toBe(true);
	});
});

describe("repository image HTML rewriting", () => {
	it("builds an encoded asset URL", () => {
		expect(buildRepoAssetUrl("images/a b.png", "feature/ui", "share id")).toBe(
			"/api/asset?path=images%2Fa+b.png&ref=feature%2Fui&s=share+id",
		);
	});

	it("rewrites same-repository image sources and escapes query separators", () => {
		const html = '<p><img src="images/a.png" alt="A"></p>';
		expect(rewriteRepoImageSources(html, context, "share-123")).toBe(
			'<p><img src="/api/asset?path=images%2Fa.png&amp;ref=main&amp;s=share-123" alt="A"></p>',
		);
	});

	it("leaves external images and local SVGs untouched", () => {
		const html =
			'<img src="https://camo.githubusercontent.com/id" alt="external"><img src="diagram.svg" alt="svg">';
		expect(rewriteRepoImageSources(html, context, "share-123")).toBe(html);
	});

	it("rewrites picture sources without mistaking data-src for src", () => {
		const html =
			'<picture><source srcset="images/dark.webp 2x"><img data-src="images/lazy.png" src="images/light.png"></picture>';
		expect(rewriteRepoImageSources(html, context, "share-123")).toBe(
			'<picture><source srcset="/api/asset?path=images%2Fdark.webp&amp;ref=main&amp;s=share-123 2x"><img data-src="images/lazy.png" src="/api/asset?path=images%2Flight.png&amp;ref=main&amp;s=share-123"></picture>',
		);
	});
});
