import { isLocale, locales, t } from "@qazsupply/i18n";
import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { REDUCE_TRANSPARENCY_COOKIE } from "../../lib/cookies";
import { Providers } from "../providers";
import "../globals.css";

// IBM Plex Sans: chosen for full Kazakh Cyrillic + default tabular figures
// (docs/design/font-coverage.md). Self-hosted by Next, no runtime request to Google.
const plex = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex",
});

export const generateStaticParams = () => locales.map((locale) => ({ locale }));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: `${t(locale, "app.name")}: ${t(locale, "home.title")}` } : {};
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const reduceTransparency = (await cookies()).get(REDUCE_TRANSPARENCY_COOKIE)?.value === "1";
  const nonce = (await headers()).get("x-nonce") ?? undefined; // set per request by proxy.ts (CSP)

  return (
    <html
      lang={locale}
      className={plex.variable}
      suppressHydrationWarning
      data-reduce-transparency={reduceTransparency ? "true" : undefined}
    >
      <body>
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
