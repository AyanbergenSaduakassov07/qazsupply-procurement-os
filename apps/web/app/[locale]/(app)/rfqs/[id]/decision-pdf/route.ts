import { apiClient } from "@qazsupply/api-client";
import { isLocale } from "@qazsupply/i18n";

import { renderDecisionPdf } from "../../../../../../components/procurement/decision-pdf";
import { procLabels } from "../../../../../../lib/procurement-labels";
import { getSession } from "../../../../../../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

/** One-click export of the decision record (same data as the memo on screen). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; id: string }> },
) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const session = await getSession();
  const org = session.status === "authenticated" ? session.currentOrg : null;
  if (session.status !== "authenticated" || !org) return new Response(null, { status: 404 });
  const { data } = await apiClient(API_URL, session.token).GET("/orgs/{org_id}/rfqs/{rfq_id}", {
    params: { path: { org_id: org.org_id, rfq_id: id } },
  });
  if (!data?.decision) return new Response(null, { status: 404 });
  const l = procLabels(locale);
  const d = data.decision as Record<string, unknown>;
  const pdf = await renderDecisionPdf({
    title: data.title,
    l,
    locale,
    decision: {
      offer_id: String(d.offer_id),
      reason: String(d.reason),
      created_at: String(d.created_at),
      alternatives: d.alternatives as never,
      decided_by: d.decided_by_me ? (l.you ?? "") : String(d.decided_by_staff ?? l.client),
    },
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="qazsupply-decision-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
