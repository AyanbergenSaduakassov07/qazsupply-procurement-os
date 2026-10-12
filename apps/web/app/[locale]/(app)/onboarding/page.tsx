import { apiClient } from "@qazsupply/api-client";
import { isLocale } from "@qazsupply/i18n";
import { EmptyState } from "@qazsupply/ui/components/states";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "../../../../components/onboarding/onboarding-views";
import { onboardingLabels } from "../../../../lib/onboarding-labels";
import { getSession } from "../../../../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  const org = session.status === "authenticated" ? session.currentOrg : null;
  if (session.status !== "authenticated" || !org) notFound();
  const { data } = await apiClient(API_URL, session.token).GET("/orgs/{org_id}/onboarding", {
    params: { path: { org_id: org.org_id } },
  });
  const labels = onboardingLabels(locale);
  const cases = data ?? [];
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">
          {org.role === "supplier" ? labels.title : labels.cases}
        </h1>
        <p className="mt-1 text-sm text-muted">{labels.intro}</p>
      </div>
      {cases.length === 0 ? (
        <EmptyState title={labels.none} message={labels.noneHint} />
      ) : (
        <ul className="space-y-2" data-testid="cases">
          {cases.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-[var(--qs-card-radius)] border border-line bg-surface p-3"
            >
              <Link
                href={`/${locale}/onboarding/${c.id}`}
                className="min-h-11 flex-1 content-center font-medium text-link underline-offset-2 hover:underline"
              >
                {c.legal_name ?? c.supplier_name ?? labels.title}
              </Link>
              <StatusBadge status={c.status} labels={labels} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
