import { isLocale, t } from "@qazsupply/i18n";
import { Card, CardBody, CardHeader, CardTitle } from "@qazsupply/ui/components/card";
import { notFound } from "next/navigation";

import { SettingsControls } from "../../../../components/shell/settings-controls";

const LANGUAGES = [
  { locale: "kk" as const, name: "Қазақша" },
  { locale: "ru" as const, name: "Русский" },
  { locale: "en" as const, name: "English" },
];

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-ink">{t(locale, "settings.title")}</h1>
      <p className="mt-1 mb-4 text-sm text-muted">{t(locale, "settings.intro")}</p>
      <Card>
        <CardHeader>
          <CardTitle>{t(locale, "theme.label")}</CardTitle>
        </CardHeader>
        <CardBody>
          <SettingsControls
            languages={LANGUAGES}
            current={locale}
            labels={{
              appearance: t(locale, "settings.appearance"),
              light: t(locale, "theme.light"),
              dark: t(locale, "theme.dark"),
              system: t(locale, "theme.system"),
              language: t(locale, "settings.language"),
              reduce: t(locale, "theme.reduceTransparency"),
              reduceHint: t(locale, "theme.reduceTransparency.hint"),
            }}
          />
        </CardBody>
      </Card>
      <p className="mt-4 text-sm">
        <a href={`/${locale}/gallery`} className="text-link hover:underline">
          {t(locale, "gallery.title")}
        </a>
      </p>
    </div>
  );
}
