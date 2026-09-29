import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, listCollections, listSharesForInstallation, managerProps } =
	vi.hoisted(() => ({
		getSession: vi.fn(),
		listCollections: vi.fn(),
		listSharesForInstallation: vi.fn(),
		managerProps: vi.fn(),
	}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("@/lib/collection-store", () => ({ listCollections }));
vi.mock("@/lib/share-store", () => ({ listSharesForInstallation }));
vi.mock("@/components/collection-manager", () => ({
	CollectionManager: (props: unknown) => {
		managerProps(props);
		return <main>관리 화면</main>;
	},
}));

import CollectionsPage from "./page";

beforeEach(() => vi.resetAllMocks());

describe("CollectionsPage", () => {
	it("requires authentication before listing any stored data", async () => {
		getSession.mockResolvedValue(null);
		render(await CollectionsPage());
		expect(screen.getByRole("link", { name: "GitHub 로그인" })).toHaveAttribute(
			"href",
			"/api/github/login",
		);
		expect(listCollections).not.toHaveBeenCalled();
		expect(listSharesForInstallation).not.toHaveBeenCalled();
		expect(managerProps).not.toHaveBeenCalled();
	});

	it("loads only the user's collections and active shares from authorized installations", async () => {
		getSession.mockResolvedValue({
			login: "example-user",
			userId: 123,
			installationIds: [20, 30],
		});
		listCollections.mockResolvedValue([]);
		listSharesForInstallation.mockImplementation(async (id: number) =>
			id === 20
				? [
						{
							id: "active",
							installationId: 20,
							owner: "example",
							repo: "one",
							expiresAt: Date.now() + 60_000,
							showReleases: true,
						},
						{
							id: "expired",
							installationId: 20,
							owner: "example",
							repo: "old",
							expiresAt: Date.now() - 60_000,
						},
					]
				: [
						{
							id: "permanent",
							installationId: 30,
							owner: "example",
							repo: "two",
						},
					],
		);
		render(await CollectionsPage());
		expect(listCollections).toHaveBeenCalledWith(123);
		expect(listSharesForInstallation.mock.calls.map(([id]) => id)).toEqual([
			20, 30,
		]);
		expect(managerProps).toHaveBeenCalledWith({
			login: "example-user",
			initialCollections: [],
			shares: [
				{ id: "active", owner: "example", repo: "one", showReleases: true },
				{ id: "permanent", owner: "example", repo: "two", showReleases: false },
			],
		});
	});

	it("shows a generic retry page on storage failure without exposing internal errors", async () => {
		getSession.mockResolvedValue({
			login: "example-user",
			userId: 123,
			installationIds: [],
		});
		listCollections.mockRejectedValue(new Error("sensitive-storage-error"));
		render(await CollectionsPage());
		expect(screen.getByRole("link", { name: "다시 시도" })).toHaveAttribute(
			"href",
			"/app/collections",
		);
		expect(
			screen.queryByText(/sensitive-storage-error/),
		).not.toBeInTheDocument();
		expect(managerProps).not.toHaveBeenCalled();
	});
});
