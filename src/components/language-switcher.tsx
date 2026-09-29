"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";

export function LanguageSwitcher() {
	const { locale, setLocale, preserveClientState, t } = useLocale();
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	function change(next: Locale) {
		if (next === locale) return;
		setLocale(next);
		// Refresh server-rendered copy without navigating away or clearing drafts.
		if (!preserveClientState) startTransition(() => router.refresh());
	}

	return (
		<div className="site-language-bar">
			<fieldset
				className="site-language-control"
				aria-label={t("화면 언어", "Interface language")}
				aria-busy={pending}
			>
				<span className="site-language-label">{t("언어", "Language")}</span>
				<button
					type="button"
					lang="ko"
					aria-pressed={locale === "ko"}
					disabled={pending}
					onClick={() => change("ko")}
				>
					한국어
				</button>
				<button
					type="button"
					lang="en"
					aria-pressed={locale === "en"}
					disabled={pending}
					onClick={() => change("en")}
				>
					English
				</button>
			</fieldset>
		</div>
	);
}
