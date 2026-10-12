import { apiClient } from "@qazsupply/api-client";
import { isLocale } from "@qazsupply/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  OnboardingReview,
  OnboardingWizard,
} from "../../../../../components/onboarding/onboarding-views";
import { onboardingLabels } from "../../../../../lib/onboarding-labels";
import { getSession } from "../../../../../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export default async function CasePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const session = await getSession();
  const org = session.status === "authenticated" ? session.currentOrg : null;
  if (session.status !== "authenticated" || !org) notFound();
  const { data } = await apiClient(API_URL, session.token).GET(
    "/orgs/{org_id}/onboarding/{case_id}",
    {
      params: { path: { org_id: org.org_id, case_id: id } },
    },
  );
  if (!data) notFound();
  const labels = onboardingLabels(locale);
  const canDecide = ["client_admin", "reviewer", "qazsupply_admin"].includes(org.role);
  return (
    <div className="max-w-2xl space-y-4">
      <Link
        href={`/${locale}/onboarding`}
        className="text-sm text-link underline-offset-2 hover:underline"
      >
        ← {data.mine ? labels.title : labels.cases}
      </Link>
      <h1 className="text-xl font-semibold text-ink">
        {data.mine ? labels.title : (data.legal_name ?? data.supplier_name ?? labels.title)}
      </h1>
      {data.mine ? (
        <>
          <p className="text-sm text-muted">{labels.intro}</p>
          <OnboardingWizard c={data} labels={labels} locale={locale} />
        </>
      ) : (
        <OnboardingReview c={data} labels={labels} locale={locale} canDecide={canDecide} />
      )}
    </div>
  );
}
