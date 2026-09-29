export type Locale = "ko" | "en";

export const LOCALE_COOKIE = "unlisted_locale";

export function normalizeLocale(value: unknown): Locale {
	return value === "en" ? "en" : "ko";
}

export function translator(locale: Locale) {
	return (korean: string, english: string): string =>
		locale === "en" ? english : korean;
}

export function intlLocale(locale: Locale): string {
	return locale === "en" ? "en-US" : "ko-KR";
}
