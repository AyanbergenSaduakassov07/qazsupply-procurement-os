import { apiClient } from "@qazsupply/api-client";
import { isLocale } from "@qazsupply/i18n";

import type { NarrativeReport } from "../../../../../../../components/report/report-narrative";
import { renderReportPdf } from "../../../../../../../components/report/report-pdf";
import { pdfLabels } from "../../../../../../../lib/report-labels";
import type { ModelFinding } from "../../../../../../../lib/report-model";
import { getSession } from "../../../../../../../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

/**
 * The report as a PDF, built from the same API data and the same formatters as the screen.
 * Visibility is the API's: a client gets 404 for anything not released.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; id: string }> },
) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const session = await getSession();
  const org = session.status === "authenticated" ? session.currentOrg : null;
  if (session.status !== "authenticated" || !org) return new Response(null, { status: 404 });
  const api = apiClient(API_URL, session.token);
  const path = { org_id: org.org_id, report_id: id };
  const [report, findings] = await Promise.all([
    api.GET("/orgs/{org_id}/reports/{report_id}", { params: { path } }),
    api.GET("/orgs/{org_id}/reports/{report_id}/findings", { params: { path } }),
  ]);
  if (!report.data) return new Response(null, { status: 404 });
  const pdf = await renderReportPdf({
    report: report.data as unknown as NarrativeReport,
    findings: (findings.data ?? []) as unknown as ModelFinding[],
    labels: pdfLabels(locale),
    locale,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="qazsupply-report-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
