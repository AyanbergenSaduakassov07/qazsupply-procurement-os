import { apiClient } from "@qazsupply/api-client";
import { isLocale, t } from "@qazsupply/i18n";
import { ErrorState } from "@qazsupply/ui/components/states";
import { notFound } from "next/navigation";

import { type QueueItem, ReviewQueue } from "../../../../../components/spend/review-queue";
import { getSession } from "../../../../../lib/session";
import { reviewLabels } from "../../../../../lib/spend-labels";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export default async function ReviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  const org = session.status === "authenticated" ? session.currentOrg : null;
  const { data } =
    session.status === "authenticated" && org
      ? await apiClient(API_URL, session.token).GET("/orgs/{org_id}/review-queue", {
          params: { path: { org_id: org.org_id }, query: { limit: 100 } },
        })
      : { data: undefined };
  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t(locale, "review.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t(locale, "review.intro")}</p>
      </div>
      {data ? (
        <ReviewQueue
          initial={data.lines as QueueItem[]}
          labels={reviewLabels(locale)}
          locale={locale}
        />
      ) : (
        <ErrorState title={t(locale, "common.error")} message={t(locale, "common.retry")} />
      )}
    </div>
  );
}
