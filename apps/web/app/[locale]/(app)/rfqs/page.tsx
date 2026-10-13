import { apiClient } from "@qazsupply/api-client";
import { isLocale } from "@qazsupply/i18n";
import { Badge } from "@qazsupply/ui/components/badge";
import { EmptyState } from "@qazsupply/ui/components/states";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "../../../../components/procurement/rfq-detail";
import { procLabels } from "../../../../lib/procurement-labels";
import { procRole } from "../../../../lib/procurement-role";
import { dateFormatter } from "../../../../lib/report-model";
import { getSession } from "../../../../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export default async function RfqsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  const org = session.status === "authenticated" ? session.currentOrg : null;
  if (session.status !== "authenticated" || !org) notFound();
  const { data } = await apiClient(API_URL, session.token).GET("/orgs/{org_id}/rfqs", {
    params: { path: { org_id: org.org_id } },
  });
  const rows = data ?? [];
  const l = procLabels(locale);
  const role = procRole(org.role);
  const date = dateFormatter(locale);
  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-ink">{l.rfqs}</h1>
          <p className="mt-1 text-sm text-muted">{l.rfqsIntro}</p>
        </div>
        {(role === "buyer" || role === "approver") && (
          <Link
            href={`/${locale}/rfqs/new`}
            className="inline-flex min-h-11 items-center rounded-[var(--qs-radius-md)] bg-[var(--qs-accent-strong)] px-4 text-sm font-medium text-white"
          >
            {l.new}
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title={l.none ?? ""}
          message={(role === "supplier" ? l.noneSupplier : l.noneHint) ?? ""}
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--qs-card-radius)] border border-line bg-surface">
          <table className="w-full text-left text-sm" data-testid="rfqs">
            <thead className="text-muted">
              <tr>
                {["col.title", "col.status", "col.deadline", "col.offers"].map((k) => (
                  <th key={k} scope="col" className="px-3 py-2 font-medium">
                    {l[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <Link
                      href={`/${locale}/rfqs/${r.id}`}
                      className="font-medium text-link underline-offset-2 hover:underline"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} l={l} />
                  </td>
                  <td className="px-3 py-2">
                    {r.deadline ? date(r.deadline) : "—"}
                    {r.due_soon && (
                      <Badge variant="gold" className="ml-2">
                        {l.dueSoon}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.offers} / {r.invites}
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
