import { apiClient } from "@qazsupply/api-client";
import { isLocale, t } from "@qazsupply/i18n";
import { Card, CardBody, CardHeader, CardTitle } from "@qazsupply/ui/components/card";
import { notFound } from "next/navigation";

import { OrgSettings } from "../../../../components/shell/org-settings";
import { SettingsControls } from "../../../../components/shell/settings-controls";
import { RiskWeights } from "../../../../components/suppliers/risk-weights";
import { getSession } from "../../../../lib/session";
import { supplierLabels } from "../../../../lib/supplier-labels";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

const LANGUAGES = [
  { locale: "kk" as const, name: "Қазақша" },
  { locale: "ru" as const, name: "Русский" },
  { locale: "en" as const, name: "English" },
];

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  const org = session.status === "authenticated" ? session.currentOrg : null;
  const settings =
    session.status === "authenticated" && org
      ? (
          await apiClient(API_URL, session.token).GET("/orgs/{org_id}/settings", {
            params: { path: { org_id: org.org_id } },
          })
        ).data
      : undefined;
  const admin = org?.role === "client_admin" || org?.role === "qazsupply_admin";
  const weights =
    session.status === "authenticated" && org && org.role !== "supplier"
      ? (
          await apiClient(API_URL, session.token).GET("/orgs/{org_id}/risk-weights", {
            params: { path: { org_id: org.org_id } },
          })
        ).data
      : undefined;
  const s360 = supplierLabels(locale);

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
      {settings && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{t(locale, "settings.org")}</CardTitle>
          </CardHeader>
          <CardBody>
            <OrgSettings
              values={settings}
              canEdit={{ ask_enabled: admin, four_eyes: org?.role === "qazsupply_admin" }}
              labels={{
                ask: t(locale, "settings.ask"),
                askHint: t(locale, "settings.askHint"),
                fourEyes: t(locale, "settings.fourEyes"),
                fourEyesHint: t(locale, "settings.fourEyesHint"),
                saved: t(locale, "settings.saved"),
                adminOnly: t(locale, "settings.adminOnly"),
                error: t(locale, "common.error"),
              }}
            />
          </CardBody>
        </Card>
      )}
      {weights && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{s360["weights.title"]}</CardTitle>
          </CardHeader>
          <CardBody>
            <RiskWeights
              defaults={weights.defaults}
              weights={weights.weights}
              canEdit={admin}
              labels={{
                factor: s360.factor,
                hint: s360["weights.hint"],
                save: s360["weights.save"],
                saved: s360["weights.saved"],
                defaultN: s360["weights.default"],
                error: s360.error,
              }}
            />
          </CardBody>
        </Card>
      )}
      <p className="mt-4 text-sm">
        <a href={`/${locale}/gallery`} className="text-link hover:underline">
          {t(locale, "gallery.title")}
        </a>
      </p>
    </div>
  );
}
