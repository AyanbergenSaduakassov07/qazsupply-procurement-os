import { apiClient } from "@qazsupply/api-client";
import { isLocale } from "@qazsupply/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ComparisonView } from "../../../../../../components/procurement/comparison-view";
import { procLabels } from "../../../../../../lib/procurement-labels";
import { procRole } from "../../../../../../lib/procurement-role";
import { getSession } from "../../../../../../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export default async function ComparePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const session = await getSession();
  const org = session.status === "authenticated" ? session.currentOrg : null;
  if (session.status !== "authenticated" || !org) notFound();
  const role = procRole(org.role);
  if (role === "supplier") notFound(); // suppliers never see other offers
  const api = apiClient(API_URL, session.token);
  const path = { org_id: org.org_id, rfq_id: id };
  const [rfq, cmp] = await Promise.all([
    api.GET("/orgs/{org_id}/rfqs/{rfq_id}", { params: { path } }),
    api.GET("/orgs/{org_id}/rfqs/{rfq_id}/comparison", { params: { path } }),
  ]);
  if (!rfq.data || !cmp.data) notFound();
  const l = procLabels(locale);
  return (
    <div className="max-w-6xl space-y-3">
      <Link
        href={`/${locale}/rfqs/${id}`}
        className="text-sm text-link underline-offset-2 hover:underline"
      >
        ← {rfq.data.title}
      </Link>
      <h1 className="text-xl font-semibold text-ink">{l["cmp.title"]}</h1>
      <ComparisonView
        c={cmp.data}
        l={l}
        locale={locale}
        canWeigh={role === "buyer" || role === "approver"}
        rfqId={id}
      />
    </div>
  );
}
