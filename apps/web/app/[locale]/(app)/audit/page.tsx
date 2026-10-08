import { apiClient } from "@qazsupply/api-client";
import { isLocale, t } from "@qazsupply/i18n";
import { Badge } from "@qazsupply/ui/components/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@qazsupply/ui/components/card";
import { notFound } from "next/navigation";

import { getSession } from "../../../../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

function StateBlock({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-muted">{message}</p>
      </CardBody>
    </Card>
  );
}

export default async function AuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await getSession();
  // Only the ACTIVE org, and only if the user is an admin there; the API re-checks (403/404).
  const membership =
    session.status === "authenticated" &&
    session.currentOrg &&
    (session.currentOrg.role === "client_admin" || session.currentOrg.role === "qazsupply_admin")
      ? session.currentOrg
      : undefined;

  const heading = (
    <div className="mb-4">
      <h1 className="text-xl font-semibold text-ink">{t(locale, "audit.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t(locale, "audit.intro")}</p>
    </div>
  );

  if (!membership) {
    return (
      <div className="max-w-3xl">
        {heading}
        <StateBlock
          title={t(locale, "common.notAvailable")}
          message={t(locale, "audit.emptyHint")}
        />
      </div>
    );
  }

  const token = session.status === "authenticated" ? session.token : undefined;
  const { data, error } = await apiClient(API_URL, token).GET("/orgs/{org_id}/audit-log", {
    params: { path: { org_id: membership.org_id }, query: { limit: 50 } },
  });

  if (error || !data) {
    return (
      <div className="max-w-3xl">
        {heading}
        <StateBlock title={t(locale, "common.error")} message={t(locale, "common.retry")} />
      </div>
    );
  }

  const dateFormat = new Intl.DateTimeFormat(
    locale === "kk" ? "kk-KZ" : locale === "ru" ? "ru-RU" : "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Almaty",
    },
  );

  return (
    <div className="max-w-3xl">
      {heading}
      <div className="mb-3">
        <Badge variant={data.chain_intact ? "ok" : "risk"}>
          {data.chain_intact ? t(locale, "audit.chainIntact") : t(locale, "audit.chainBroken")}
        </Badge>
      </div>
      {data.entries.length === 0 ? (
        <StateBlock title={t(locale, "audit.empty")} message={t(locale, "audit.emptyHint")} />
      ) : (
        <Card>
          <CardBody className="p-0">
            <section
              tabIndex={0}
              aria-label={t(locale, "audit.title")}
              className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)]"
            >
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-surface-raised text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">
                      {t(locale, "audit.column.time")}
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      {t(locale, "audit.column.actor")}
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      {t(locale, "audit.column.action")}
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      {t(locale, "audit.column.entity")}
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      {t(locale, "audit.column.hash")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr key={entry.id} className="border-line border-t">
                      <td className="px-4 py-2 text-muted">
                        <time dateTime={entry.created_at}>
                          {dateFormat.format(new Date(entry.created_at))}
                        </time>
                      </td>
                      <td
                        className="px-4 py-2 font-mono text-xs"
                        title={entry.actor_id ?? undefined}
                      >
                        {entry.actor_id ? entry.actor_id.slice(0, 8) : "—"}
                      </td>
                      <td className="px-4 py-2">{entry.action}</td>
                      <td className="px-4 py-2">{entry.entity}</td>
                      <td className="px-4 py-2 font-mono text-xs" data-volatile>
                        {entry.hash.slice(0, 12)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
