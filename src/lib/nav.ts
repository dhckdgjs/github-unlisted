// Shared primary-nav item list. Both the desktop nav (NavLinks) and the
// mobile drawer (SiteDrawer) render from this single array so the menu
// items stay identical across platforms. Order here is the render order:
// Home first, Dashboard second (signed-in only), then the static pages.

export type NavKey =
	| "home"
	| "dashboard"
	| "collections"
	| "faq"
	| "privacy"
	| "status";
export type NavActive = NavKey | null;

export interface NavItem {
	key: NavKey;
	label: string;
	labelKo: string;
	href: string;
	// Only render when a session exists (the owner is signed in).
	signedInOnly?: boolean;
	// Render the operational-status indicator dot after the label.
	dot?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
	{ key: "home", label: "Home", labelKo: "홈", href: "/" },
	{
		key: "dashboard",
		label: "Dashboard",
		labelKo: "저장소 관리",
		href: "/app",
		signedInOnly: true,
	},
	{
		key: "collections",
		label: "Collections",
		labelKo: "공유 목록 관리",
		href: "/app/collections",
		signedInOnly: true,
	},
	{ key: "faq", label: "FAQ", labelKo: "자주 묻는 질문", href: "/faq" },
	{
		key: "privacy",
		label: "Privacy",
		labelKo: "개인정보 안내",
		href: "/privacy",
	},
	{
		key: "status",
		label: "Status",
		labelKo: "서비스 상태",
		href: "/status",
		dot: true,
	},
];
