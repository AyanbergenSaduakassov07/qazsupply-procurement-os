import { apiClient } from "@qazsupply/api-client";
import { isLocale, t } from "@qazsupply/i18n";
import { Badge } from "@qazsupply/ui/components/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@qazsupply/ui/components/card";
import { notFound } from "next/navigation";

import { getSession } from "../../../lib/session";

type ReportStatus = "draft" | "in_review" | "approved" | "released" | "rejected" | "superseded";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

async function apiStatus(): Promise<"ok" | "down"> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    return res.ok ? "ok" : "down";
  } catch {
    return "down";
  }
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [status, session] = await Promise.all([apiStatus(), getSession()]);
  const org = session.status === "authenticated" ? session.currentOrg : null;

  // Reports the caller may see in the active org (RLS: clients see released ones only).
  const reports =
    session.status === "authenticated" && org
      ? ((
          await apiClient(API_URL, session.token).GET("/orgs/{org_id}/reports", {
            params: { path: { org_id: org.org_id } },
          })
        ).data ?? [])
      : [];

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t(locale, "home.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t(locale, "home.notice")}</p>
      </div>
      {org && (
        <Card>
          <CardHeader>
            <CardTitle>{t(locale, "home.currentOrg")}</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-ink" data-testid="current-org">
              {org.org_name}
            </p>
            <p className="mt-1 text-sm text-muted">
              {t(locale, "home.yourRole")}: {t(locale, `role.${org.role}`)}
            </p>
            {reports.length > 0 && (
              <ul className="mt-3 space-y-1" data-testid="reports">
                {reports.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-sm text-ink">
                    <span className="flex-1">{r.title}</span>
                    <Badge variant="neutral">
                      {t(locale, `report.status.${r.status as ReportStatus}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t(locale, "home.status.label")}</CardTitle>
        </CardHeader>
        <CardBody>
          <p data-testid="api-status" data-status={status} className="text-sm text-ink">
            {t(locale, `home.status.${status}`)}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
