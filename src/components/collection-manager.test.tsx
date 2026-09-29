import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CollectionRecord } from "@/lib/collection-store";
import { CollectionManager } from "./collection-manager";

const shares = [
	{ id: "share-first", owner: "example", repo: "first", showReleases: true },
	{ id: "share-second", owner: "example", repo: "second", showReleases: false },
];
const collection: CollectionRecord = {
	id: "00000000-0000-4000-8000-000000000001",
	ownerUserId: 123,
	title: "자료 모음",
	description: "카탈로그 소개",
	items: [
		{ shareId: "share-first", label: "첫 번째 자료", description: "첫 설명" },
		{ shareId: "share-second", label: "두 번째 자료", description: "둘 설명" },
	],
	createdAt: 1,
	updatedAt: 1,
	enabled: true,
};

afterEach(() => vi.unstubAllGlobals());

function setup(initialCollections: CollectionRecord[] = [collection]) {
	return render(
		<CollectionManager
			initialCollections={initialCollections}
			shares={shares}
			login="example-user"
		/>,
	);
}

describe("CollectionManager", () => {
	it("saves edited descriptions and reordered items to the same collection URL", async () => {
		const fetcher = vi.fn().mockImplementation(async (_url, options) => {
			const input = JSON.parse(options.body);
			return {
				ok: true,
				json: async () => ({
					collection: { ...collection, ...input, updatedAt: 2 },
				}),
			};
		});
		vi.stubGlobal("fetch", fetcher);
		setup();
		fireEvent.change(screen.getByLabelText("자료 설명 2"), {
			target: { value: "수정한 설명" },
		});
		fireEvent.click(screen.getByRole("button", { name: "2번 자료 위로" }));
		fireEvent.click(screen.getByRole("button", { name: "변경 사항 저장" }));
		await screen.findByRole("status");
		expect(fetcher).toHaveBeenCalledTimes(1);
		const [url, options] = fetcher.mock.calls[0];
		expect(url).toBe("/api/collections");
		expect(options.method).toBe("PATCH");
		expect(JSON.parse(options.body)).toEqual({
			id: collection.id,
			title: collection.title,
			description: collection.description,
			items: [
				{ ...collection.items[1], description: "수정한 설명" },
				collection.items[0],
			],
		});
		expect(screen.getByRole("link", { name: /카탈로그 열기/ })).toHaveAttribute(
			"href",
			`/collections/${collection.id}`,
		);
	});

	it("adds only a selected existing share and can remove it before creating", async () => {
		const fetcher = vi.fn().mockImplementation(async (_url, options) => ({
			ok: true,
			json: async () => ({
				collection: { ...collection, ...JSON.parse(options.body) },
			}),
		}));
		vi.stubGlobal("fetch", fetcher);
		setup([]);
		fireEvent.change(screen.getByLabelText("제목"), {
			target: { value: "새 자료 모음" },
		});
		fireEvent.change(screen.getByLabelText("추가할 저장소"), {
			target: { value: "share-first" },
		});
		fireEvent.click(screen.getByRole("button", { name: "자료 추가" }));
		expect(
			within(screen.getByLabelText("추가할 저장소")).queryByRole("option", {
				name: /example\/first/,
			}),
		).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "1번 자료 제거" }));
		expect(
			within(screen.getByLabelText("추가할 저장소")).getByRole("option", {
				name: /example\/first/,
			}),
		).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText("추가할 저장소"), {
			target: { value: "share-second" },
		});
		fireEvent.click(screen.getByRole("button", { name: "자료 추가" }));
		fireEvent.click(screen.getByRole("button", { name: "카탈로그 만들기" }));
		await screen.findByRole("status");
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(fetcher.mock.calls[0][1].method).toBe("POST");
		expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
			title: "새 자료 모음",
			description: "",
			items: [{ shareId: "share-second", label: "second", description: "" }],
		});
	});

	it("disables and re-enables the catalog without sending unsaved changes or touching repo shares", async () => {
		const fetcher = vi.fn().mockImplementation(async (_url, options) => ({
			ok: true,
			json: async () => ({
				collection: {
					...collection,
					enabled: JSON.parse(options.body).enabled,
				},
			}),
		}));
		vi.stubGlobal("fetch", fetcher);
		setup();
		fireEvent.change(screen.getByLabelText("제목"), {
			target: { value: "아직 저장하지 않은 제목" },
		});
		fireEvent.click(screen.getByRole("button", { name: "공유 중지" }));
		await screen.findByRole("button", { name: "공유 다시 시작" });
		expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
			id: collection.id,
			enabled: false,
		});
		expect(screen.getByLabelText("제목")).toHaveValue(
			"아직 저장하지 않은 제목",
		);
		fireEvent.click(screen.getByRole("button", { name: "공유 다시 시작" }));
		await screen.findByRole("button", { name: "공유 중지" });
		expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
			id: collection.id,
			enabled: true,
		});
		expect(
			fetcher.mock.calls.every(([url]) => url === "/api/collections"),
		).toBe(true);
	});

	it("keeps edits available when saving fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("연결에 실패했습니다.")),
		);
		setup();
		fireEvent.change(screen.getByLabelText("설명"), {
			target: { value: "보존할 변경 사항" },
		});
		fireEvent.click(screen.getByRole("button", { name: "변경 사항 저장" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"연결에 실패했습니다.",
		);
		expect(screen.getByLabelText("설명")).toHaveValue("보존할 변경 사항");
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "변경 사항 저장" }),
			).toBeEnabled(),
		);
	});

	it("requires removal of a missing share before saving", () => {
		setup([
			{
				...collection,
				items: [
					{ shareId: "missing-share", label: "이전 자료", description: "" },
				],
			},
		]);
		fireEvent.change(screen.getByLabelText("제목"), {
			target: { value: "수정한 제목" },
		});
		expect(
			screen.getByText(/현재 사용할 수 없는 공유 링크가 1개/),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "변경 사항 저장" }),
		).toBeDisabled();
		fireEvent.click(screen.getByRole("button", { name: "1번 자료 제거" }));
		expect(
			screen.getByRole("button", { name: "변경 사항 저장" }),
		).toBeEnabled();
	});

	it("copies the stable absolute catalog URL", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", { clipboard: { writeText } });
		setup();
		fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
		await screen.findByRole("status");
		expect(writeText).toHaveBeenCalledWith(
			`${window.location.origin}/collections/${collection.id}`,
		);
	});
});
