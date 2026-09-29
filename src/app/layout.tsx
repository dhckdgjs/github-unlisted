import "@/styles/language.css";
import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { JsonLd } from "@/components/json-ld";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LocaleProvider } from "@/components/locale-provider";
import { PublicSiteAnalytics } from "@/components/public-site-analytics";
import { translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { SITE, siteGraphLd } from "@/lib/seo";

// Only the namespaced language control is shared here. Site and viewer styles
// remain isolated: global.css (site), dashboard.css (/app), viewer.css (files).

// gsans is a variable font; the full 100-900 weight range is available,
// so weights are picked freely in CSS. It replaces both the old sans
// (Geist) and serif (Instrument Serif); --font-serif aliases --font-sans
// in global.css. Mono stays Geist Mono.
const sans = localFont({
	src: "../fonts/gsans.ttf",
	variable: "--font-sans",
	weight: "100 900",
	display: "swap",
});
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

const baseMetadata: Metadata = {
	metadataBase: new URL(SITE.url),
	title: { default: SITE.defaultTitle, template: SITE.titleTemplate },
	description: SITE.description,
	applicationName: SITE.name,
	authors: [{ name: SITE.author.name, url: SITE.author.url }],
	creator: SITE.author.name,
	alternates: { canonical: "/" },
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-image-preview": "large",
			"max-snippet": -1,
			"max-video-preview": -1,
		},
	},
	openGraph: {
		type: "website",
		siteName: SITE.name,
		locale: SITE.locale,
		title: SITE.defaultTitle,
		description: SITE.description,
		url: SITE.url,
	},
	twitter: {
		card: "summary_large_image",
		title: SITE.defaultTitle,
		description: SITE.description,
	},
};

export async function generateMetadata(): Promise<Metadata> {
	const locale = await getLocale();
	const t = translator(locale);
	const title = t(
		"Unlisted Repo — 비공개 GitHub 저장소 링크 공유",
		SITE.defaultTitle,
	);
	const description = t(
		"비공개 GitHub 저장소를 읽기 전용 링크로 공유하세요. 받는 사람은 GitHub 계정이 없어도 볼 수 있고, 소유자는 GitHub에서 접근 권한을 관리합니다.",
		SITE.description,
	);
	return {
		...baseMetadata,
		title: { default: title, template: SITE.titleTemplate },
		description,
		openGraph: {
			type: "website",
			siteName: SITE.name,
			locale: locale === "ko" ? "ko_KR" : "en_US",
			title,
			description,
			url: SITE.url,
		},
		twitter: { card: "summary_large_image", title, description },
	};
}

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	colorScheme: "dark",
	themeColor: "#0a0b0e",
};

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const locale = await getLocale();
	return (
		<html lang={locale} className={`${sans.variable} ${mono.variable}`}>
			<body>
				<LocaleProvider initialLocale={locale}>
					<LanguageSwitcher />
					{children}
				</LocaleProvider>
				<JsonLd data={siteGraphLd()} />
				<PublicSiteAnalytics />
			</body>
		</html>
	);
}
