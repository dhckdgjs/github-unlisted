import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublicCollection, notFound } = vi.hoisted(() => ({
	getPublicCollection: vi.fn(),
	notFound: vi.fn(() => {
		throw new Error("NOT_FOUND");
	}),
}));
vi.mock("@/lib/collection-service", () => ({ getPublicCollection }));
vi.mock("next/navigation", () => ({ notFound }));

import PublicCollectionPage, {
	dynamic,
	fetchCache,
	metadata,
	revalidate,
} from "./page";

const collection = {
	id: "00000000-0000-4000-8000-000000000001",
	title: "개인 자료",
	description: "안내 문구",
	items: [
		{
			shareId: "second-share",
			label: "자료 B",
			description: "B 설명",
			owner: "example",
			repo: "b",
			showReleases: false,
		},
		{
			shareId: "first-share",
			label: "자료 A",
			description: "A 설명",
			owner: "example",
			repo: "a",
			showReleases: true,
		},
	],
};

beforeEach(() => {
	vi.clearAllMocks();
	getPublicCollection.mockResolvedValue(collection);
});

describe("PublicCollectionPage", () => {
	it("renders items in saved order and links only permitted releases", async () => {
		render(
			await PublicCollectionPage({
				params: Promise.resolve({ id: collection.id }),
			}),
		);
		expect(
			screen
				.getAllByRole("heading", { level: 2 })
				.map((heading) => heading.textContent),
		).toEqual(["자료 B", "자료 A"]);
		const readmeLinks = screen.getAllByRole("link", { name: /README 열기/ });
		expect(readmeLinks[0]).toHaveAttribute("href", "/example/b?s=second-share");
		expect(screen.getAllByRole("link", { name: /Releases 열기/ })).toHaveLength(
			1,
		);
		expect(screen.getByRole("link", { name: /Releases 열기/ })).toHaveAttribute(
			"href",
			"/example/a/releases?s=first-share",
		);
		for (const link of screen.getAllByRole("link")) {
			expect(link).toHaveAttribute("rel", "noreferrer");
			expect(link).toHaveAttribute("referrerpolicy", "no-referrer");
		}
		expect(screen.getByText(/링크를 전달하면/)).toBeInTheDocument();
	});

	it("uses a generic missing page for unavailable catalogs", async () => {
		getPublicCollection.mockResolvedValue(null);
		await expect(
			PublicCollectionPage({ params: Promise.resolve({ id: "missing" }) }),
		).rejects.toThrow("NOT_FOUND");
		expect(notFound).toHaveBeenCalledOnce();
	});

	it("renders an empty state without leaking missing item identifiers", async () => {
		getPublicCollection.mockResolvedValue({ ...collection, items: [] });
		render(
			await PublicCollectionPage({
				params: Promise.resolve({ id: collection.id }),
			}),
		);
		expect(
			screen.getByRole("heading", { name: "현재 열 수 있는 자료가 없습니다" }),
		).toBeInTheDocument();
		expect(screen.queryByRole("link")).not.toBeInTheDocument();
	});

	it("keeps bearer URLs and private content out of metadata and opts out of caches", () => {
		expect(dynamic).toBe("force-dynamic");
		expect(revalidate).toBe(0);
		expect(fetchCache).toBe("force-no-store");
		expect(metadata.robots).toMatchObject({ index: false, follow: false });
		expect(metadata.alternates?.canonical).toBeNull();
		expect(metadata.referrer).toBe("no-referrer");
		expect(JSON.stringify(metadata)).not.toContain(collection.id);
		expect(JSON.stringify(metadata)).not.toContain(collection.title);
		expect(JSON.stringify(metadata)).not.toContain(
			`${collection.items[0].owner}/${collection.items[0].repo}`,
		);
	});
});
