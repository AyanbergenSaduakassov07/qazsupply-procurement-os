import { apiClient } from "@qazsupply/api-client";
import { isLocale, t } from "@qazsupply/i18n";
import { notFound } from "next/navigation";

import { type FindingRow, FindingsView } from "../../../../../../components/spend/findings-view";
import { getSession } from "../../../../../../lib/session";
import { findingsLabels } from "../../../../../../lib/spend-labels";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const session = await getSession();
  const org = session.status === "authenticated" ? session.currentOrg : null;
  if (session.status !== "authenticated" || !org) notFound();
  const api = apiClient(API_URL, session.token);
  const [reports, findings] = await Promise.all([
    api.GET("/orgs/{org_id}/reports", { params: { path: { org_id: org.org_id } } }),
    api.GET("/orgs/{org_id}/reports/{report_id}/findings", {
      params: { path: { org_id: org.org_id, report_id: id } },
    }),
  ]);
  const report = reports.data?.find((r) => r.id === id);
  if (!report) notFound(); // invisible to this user (e.g. a client and an unreleased report)
  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{report.title}</h1>
        {report.status !== "released" && (
          <p className="mt-1 text-sm text-muted" data-testid="draft-notice">
            {t(locale, "findings.draft")}
          </p>
        )}
      </div>
      <FindingsView
        findings={(findings.data ?? []) as unknown as FindingRow[]}
        labels={findingsLabels(locale)}
        locale={locale}
      />
    </div>
  );
}
