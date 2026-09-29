"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { LOCALE_COOKIE, type Locale, translator } from "@/lib/i18n";

const LocaleContext = createContext({
	locale: "ko" as Locale,
	setLocale: (_locale: Locale) => {},
	preserveClientState: false,
	registerRefreshGuard: () => () => {},
});

export function LocaleProvider({
	initialLocale,
	children,
}: {
	initialLocale: Locale;
	children: React.ReactNode;
}) {
	const [locale, updateLocale] = useState(initialLocale);
	const [refreshGuards, setRefreshGuards] = useState(0);
	const registerRefreshGuard = useCallback(() => {
		setRefreshGuards((count) => count + 1);
		return () => setRefreshGuards((count) => Math.max(0, count - 1));
	}, []);
	useEffect(() => updateLocale(initialLocale), [initialLocale]);
	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	function setLocale(next: Locale) {
		if (next !== "ko" && next !== "en") return;
		updateLocale(next);
		// biome-ignore lint/suspicious/noDocumentCookie: The preference must be set synchronously before the server refresh, including in browsers without Cookie Store.
		document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
	}

	return (
		<LocaleContext.Provider
			value={{
				locale,
				setLocale,
				preserveClientState: refreshGuards > 0,
				registerRefreshGuard,
			}}
		>
			{children}
		</LocaleContext.Provider>
	);
}

export function useLocale() {
	const context = useContext(LocaleContext);
	return { ...context, t: translator(context.locale) };
}

// Fully client-rendered pages translate without fetching server data again.
// In particular, an upstream outage must not unmount an unsaved editor draft.
export function useClientLocalePage(koreanTitle: string, englishTitle: string) {
	const { registerRefreshGuard, t } = useLocale();
	useEffect(() => registerRefreshGuard(), [registerRefreshGuard]);
	const title = t(koreanTitle, englishTitle);
	useEffect(() => {
		document.title = `${title} — Unlisted Repo`;
	}, [title]);
}
