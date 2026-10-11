import { apiClient } from "@qazsupply/api-client";
import { isLocale, t } from "@qazsupply/i18n";
import { Badge } from "@qazsupply/ui/components/badge";
import { EmptyState } from "@qazsupply/ui/components/states";
import { notFound } from "next/navigation";

import { RunAnalysisButton } from "../../../../../components/spend/findings-view";
import { getSession } from "../../../../../lib/session";
import { analysisErrors } from "../../../../../lib/spend-labels";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const SLA_HOURS = 48;

function SlaBadge({
  submittedAt,
  template,
  overdue,
}: {
  submittedAt: string;
  template: string;
  overdue: string;
}) {
  const hours = Math.floor((Date.now() - new Date(submittedAt).getTime()) / 3_600_000);
  const late = hours >= SLA_HOURS;
  const text = template.replace("{hours}", String(hours)).replace("{target}", String(SLA_HOURS));
  return (
    <Badge variant={late ? "risk" : "neutral"} data-testid="list-sla">
      {late ? `${text} · ${overdue}` : text}
    </Badge>
  );
}
type ReportStatus = "draft" | "in_review" | "approved" | "released" | "rejected" | "superseded";

export default async function ReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  const org = session.status === "authenticated" ? session.currentOrg : null;
  const staff = org?.role === "reviewer" || org?.role === "qazsupply_admin";
  const { data } =
    session.status === "authenticated" && org
      ? await apiClient(API_URL, session.token).GET("/orgs/{org_id}/reports", {
          params: { path: { org_id: org.org_id } },
        })
      : { data: undefined };
  const reports = data ?? [];
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold text-ink">{t(locale, "findings.title")}</h1>
      {staff && (
        <RunAnalysisButton
          label={t(locale, "findings.run")}
          runningLabel={t(locale, "findings.running")}
          locale={locale}
          errors={analysisErrors(locale)}
        />
      )}
      {reports.length === 0 ? (
        <EmptyState title={t(locale, "findings.none")} message={t(locale, "findings.noneHint")} />
      ) : (
        <ul className="space-y-2" data-testid="report-list">
          {reports.map((r) => (
            <li key={r.id}>
              <a
                href={`/${locale}/spend/reports/${r.id}`}
                className="flex items-center gap-3 rounded-[var(--qs-card-radius)] border border-line bg-surface p-4 text-sm text-ink hover:bg-surface-raised"
              >
                <span className="flex-1">{r.title}</span>
                {staff && r.status === "in_review" && r.submitted_at && (
                  <SlaBadge
                    submittedAt={r.submitted_at}
                    template={t(locale, "gate.sla")}
                    overdue={t(locale, "gate.overdue")}
                  />
                )}
                <Badge variant="neutral">
                  {t(locale, `report.status.${r.status as ReportStatus}`)}
                </Badge>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
