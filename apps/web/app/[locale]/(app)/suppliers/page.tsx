import { apiClient } from "@qazsupply/api-client";
import { isLocale, t } from "@qazsupply/i18n";
import { Badge } from "@qazsupply/ui/components/badge";
import { EmptyState } from "@qazsupply/ui/components/states";
import Link from "next/link";
import { notFound } from "next/navigation";

import { type Verdict, VerdictBadge } from "../../../../components/suppliers/verdict";
import { moneyFormatter } from "../../../../lib/report-model";
import { getSession } from "../../../../lib/session";
import { supplierLabels } from "../../../../lib/supplier-labels";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export default async function SuppliersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  const org = session.status === "authenticated" ? session.currentOrg : null;
  if (session.status !== "authenticated" || !org) notFound();
  const { data } = await apiClient(API_URL, session.token).GET("/orgs/{org_id}/suppliers", {
    params: { path: { org_id: org.org_id } },
  });
  const rows = data ?? [];
  const labels = supplierLabels(locale);
  const money = moneyFormatter(locale);
  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t(locale, "s360.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t(locale, "s360.intro")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="gold">{labels.sample}</Badge>
        <span className="text-xs text-muted">{labels.sampleHint}</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t(locale, "s360.empty")} message={t(locale, "s360.emptyHint")} />
      ) : (
        <div className="overflow-x-auto rounded-[var(--qs-card-radius)] border border-line bg-surface">
          <table className="w-full text-left text-sm" data-testid="suppliers">
            <thead className="text-muted">
              <tr>
                {(["supplier", "bin", "verdict", "reasons", "spend"] as const).map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 font-medium">
                    {t(locale, `s360.col.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <Link
                      href={`/${locale}/suppliers/${r.id}`}
                      className="font-medium text-link underline-offset-2 hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted">{r.bin ?? "—"}</td>
                  <td className="px-3 py-2">
                    <VerdictBadge verdict={r.verdict as Verdict | null} labels={labels.verdict} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {r.top.map((code) => labels.factor[code] ?? code).join("; ")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(Math.round(Number(r.spend_kzt) * 100))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
