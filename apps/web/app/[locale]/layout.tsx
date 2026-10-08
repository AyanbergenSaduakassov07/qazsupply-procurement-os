import "@qazsupply/design-tokens/tokens.css";
import { isLocale, locales, t } from "@qazsupply/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const generateStaticParams = () => locales.map((locale) => ({ locale }));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: `${t(locale, "app.name")}: ${t(locale, "home.title")}` } : {};
}

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale}>
      <body style={{ margin: 0, background: "var(--qs-frost)", color: "var(--qs-ink)" }}>
        {children}
      </body>
    </html>
  );
}
