import { apiClient } from "@qazsupply/api-client";
import { isLocale } from "@qazsupply/i18n";
import { notFound } from "next/navigation";

import { CatalogueView } from "../../../../components/procurement/catalogue-view";
import { procLabels } from "../../../../lib/procurement-labels";
import { procRole } from "../../../../lib/procurement-role";
import { getSession } from "../../../../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export default async function CataloguePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; attr?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { q = "", attr = "" } = await searchParams;
  const session = await getSession();
  const org = session.status === "authenticated" ? session.currentOrg : null;
  if (session.status !== "authenticated" || !org || procRole(org.role) === "supplier") notFound();
  const api = apiClient(API_URL, session.token);
  const path = { org_id: org.org_id };
  const [found, acc] = await Promise.all([
    api.GET("/orgs/{org_id}/catalogue", {
      params: {
        path,
        query: { q: q.slice(0, 200), ...(attr.includes(":") ? { attr: [attr] } : {}) },
      },
    }),
    api.GET("/orgs/{org_id}/catalogue-acceptance", { params: { path } }),
  ]);
  const l = procLabels(locale);
  const data = (found.data ?? {}) as {
    results?: unknown[];
    empty_reason?: string | null;
    name_matches?: number;
  };
  const role = procRole(org.role);
  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{l["cat.title"]}</h1>
        <p className="mt-1 text-sm text-muted">{l["cat.intro"]}</p>
      </div>
      <CatalogueView
        l={l}
        locale={locale}
        q={q}
        attr={attr}
        results={(data.results ?? []) as never[]}
        emptyReason={data.empty_reason ?? null}
        nameMatches={data.name_matches ?? 0}
        acceptance={((acc.data ?? {}) as { rate?: string | null }).rate ?? null}
        canEdit={role === "buyer" || role === "approver"}
      />
    </div>
  );
}
