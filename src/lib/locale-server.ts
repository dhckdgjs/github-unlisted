import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

// A non-sensitive, host-only preference. Never put language parameters into
// bearer URLs or change repository paths when switching the interface language.
export async function getLocale() {
	return normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
