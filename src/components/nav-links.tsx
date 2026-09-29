"use client";

import { useLocale } from "@/components/locale-provider";
import { NAV_ITEMS, type NavActive } from "@/lib/nav";
import {
	CURRENT_STATUS,
	statusDotAriaLabel,
	statusDotClass,
} from "@/lib/site-status";

// Desktop / tablet inline nav. Mirrors SiteDrawer (mobile) so the menu
// items are identical across platforms. Labels render uppercase to match
// the existing chrome; the drawer renders the same labels in title case.
export function NavLinks({
	signedIn,
	active = null,
}: {
	signedIn: boolean;
	active?: NavActive;
}) {
	const { t } = useLocale();
	const statusLabel = t(
		CURRENT_STATUS.type === "okay"
			? "상태: 정상"
			: CURRENT_STATUS.type === "maintenance-medium"
				? "상태: 주의"
				: "상태: 심각",
		statusDotAriaLabel(CURRENT_STATUS),
	);
	return (
		<nav className="nav-links" aria-label={t("주 메뉴", "Primary")}>
			{NAV_ITEMS.filter((item) => !item.signedInOnly || signedIn).map(
				(item) => (
					<a
						key={item.key}
						href={item.href}
						className={active === item.key ? "is-active" : undefined}
						aria-current={active === item.key ? "page" : undefined}
					>
						{t(item.labelKo, item.label).toUpperCase()}
						{item.dot && (
							<>
								{" "}
								<span
									className={`status-dot ${statusDotClass(CURRENT_STATUS)}`}
									role="img"
									aria-label={statusLabel}
								/>
							</>
						)}
					</a>
				),
			)}
		</nav>
	);
}
