import { isLocale, locales, t } from "@qazsupply/i18n";
import { notFound } from "next/navigation";

const LANGUAGE_NAMES = { kk: "Қазақша", ru: "Русский", en: "English" } as const;

async function apiStatus(): Promise<"ok" | "down"> {
  try {
    const res = await fetch(`${process.env.API_URL ?? "http://localhost:8000"}/health`, {
      cache: "no-store",
    });
    return res.ok ? "ok" : "down";
  } catch {
    return "down";
  }
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const status = await apiStatus();
  return (
    <main
      style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui" }}
    >
      <nav aria-label={t(locale, "nav.language")} style={{ display: "flex", gap: 16 }}>
        {locales.map((l) => (
          <a key={l} href={`/${l}`} lang={l} aria-current={l === locale ? "page" : undefined}>
            {LANGUAGE_NAMES[l]}
          </a>
        ))}
      </nav>
      <h1>{t(locale, "app.name")}</h1>
      <p>{t(locale, "home.title")}</p>
      <p>{t(locale, "home.notice")}</p>
      <p data-testid="api-status" data-status={status}>
        {t(locale, "home.status.label")}: {t(locale, `home.status.${status}`)}
      </p>
    </main>
  );
}
