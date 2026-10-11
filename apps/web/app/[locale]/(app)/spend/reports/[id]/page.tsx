import { apiClient } from "@qazsupply/api-client";
import { isLocale, t } from "@qazsupply/i18n";
import { notFound } from "next/navigation";

import {
  type ConsoleEntry,
  type ConsoleFinding,
  type ConsoleReport,
  ReviewConsole,
} from "../../../../../../components/review/review-console";
import { type FindingRow, FindingsView } from "../../../../../../components/spend/findings-view";
import { consoleLabels } from "../../../../../../lib/review-labels";
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
  const staff = org.role === "reviewer" || org.role === "qazsupply_admin";
  const api = apiClient(API_URL, session.token);
  const path = { org_id: org.org_id, report_id: id };
  const [report, findings, history] = await Promise.all([
    api.GET("/orgs/{org_id}/reports/{report_id}", { params: { path } }),
    api.GET("/orgs/{org_id}/reports/{report_id}/findings", { params: { path } }),
    staff
      ? api.GET("/orgs/{org_id}/reports/{report_id}/reviews", { params: { path } })
      : Promise.resolve({ data: [] }),
  ]);
  // 404 for anyone who may not see it (a client and an unreleased report, another tenant).
  if (!report.data) notFound();
  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{report.data.title}</h1>
        {staff && report.data.status !== "released" && (
          <p className="mt-1 text-sm text-muted" data-testid="draft-notice">
            {t(locale, "findings.draft")}
          </p>
        )}
      </div>
      {staff ? (
        <ReviewConsole
          report={report.data as unknown as ConsoleReport}
          findings={(findings.data ?? []) as unknown as ConsoleFinding[]}
          history={(history.data ?? []) as unknown as ConsoleEntry[]}
          labels={consoleLabels(locale)}
          locale={locale}
        />
      ) : (
        <FindingsView
          findings={(findings.data ?? []) as unknown as FindingRow[]}
          labels={findingsLabels(locale)}
          locale={locale}
        />
      )}
    </div>
  );
}
