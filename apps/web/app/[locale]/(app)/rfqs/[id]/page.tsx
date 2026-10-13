import { apiClient } from "@qazsupply/api-client";
import { isLocale } from "@qazsupply/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RfqDetail } from "../../../../../components/procurement/rfq-detail";
import { procLabels } from "../../../../../lib/procurement-labels";
import { procRole } from "../../../../../lib/procurement-role";
import { getSession } from "../../../../../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export default async function RfqPage({
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
  const role = procRole(org.role);
  const [rfq, suppliers] = await Promise.all([
    api.GET("/orgs/{org_id}/rfqs/{rfq_id}", {
      params: { path: { org_id: org.org_id, rfq_id: id } },
    }),
    role === "buyer" || role === "approver"
      ? api.GET("/orgs/{org_id}/suppliers", { params: { path: { org_id: org.org_id } } })
      : Promise.resolve({ data: [] }),
  ]);
  if (!rfq.data) notFound();
  const l = procLabels(locale);
  return (
    <div className="max-w-4xl space-y-3">
      <Link
        href={`/${locale}/rfqs`}
        className="text-sm text-link underline-offset-2 hover:underline"
      >
        ← {l.rfqs}
      </Link>
      <RfqDetail
        rfq={rfq.data}
        l={l}
        locale={locale}
        role={role}
        suppliers={(suppliers.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
