"use client";

import * as React from "react";
import { useLocale } from "@/components/locale-provider";

export function MaintenanceNotice() {
	const { t } = useLocale();
	const [open, setOpen] = React.useState(true);

	React.useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open]);

	if (!open) return null;

	return (
		<div
			className="maint-overlay"
			role="dialog"
			aria-modal="true"
			aria-labelledby="maint-title"
		>
			<button
				type="button"
				className="maint-backdrop"
				aria-label={t("안내 닫기", "Close notice")}
				onClick={() => setOpen(false)}
			/>
			<div className="maint-card">
				<button
					type="button"
					className="maint-close"
					aria-label={t("안내 닫기", "Close notice")}
					onClick={() => setOpen(false)}
				>
					<svg
						viewBox="0 0 24 24"
						width="14"
						height="14"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
				<p id="maint-title" className="maint-body">
					{t(
						"현재 대시보드를 점검하고 있습니다. 가능성은 낮지만 이용 중 문제가 발생할 수 있습니다.",
						"We are currently doing maintenance work on the dashboard. While unlikely, you may encounter problems in operations.",
					)}
				</p>
				<p className="maint-eta">
					{t(
						"26일 01:43 UTC까지 정상 운영을 재개할 예정입니다.",
						"We expect to be fully operational by 01:43 UTC, 26th.",
					)}
				</p>
			</div>
		</div>
	);
}
