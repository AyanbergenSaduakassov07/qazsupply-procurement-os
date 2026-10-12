import { apiClient } from "@qazsupply/api-client";
import { isLocale } from "@qazsupply/i18n";
import { Card, CardBody, CardHeader, CardTitle } from "@qazsupply/ui/components/card";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { Degraded } from "../../../../../app/supplier-actions";
import { InviteForm } from "../../../../../components/onboarding/onboarding-views";
import { DossierView } from "../../../../../components/suppliers/dossier-view";
import { onboardingLabels } from "../../../../../lib/onboarding-labels";
import { getSession } from "../../../../../lib/session";
import { supplierLabels } from "../../../../../lib/supplier-labels";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const DECIDERS = new Set(["client_admin", "reviewer", "qazsupply_admin"]);

export default async function DossierPage({
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
  const path = { org_id: org.org_id, supplier_id: id };
  let dossier = await api.GET("/orgs/{org_id}/suppliers/{supplier_id}/dossier", {
    params: { path },
  });
  if (!dossier.data) notFound();
  // First visit: build it (registry refresh + screening); a source outage is shown, not hidden.
  let degraded: Degraded[] = [];
  if (dossier.data.resolved && !dossier.data.built) {
    const built = await api.POST("/orgs/{org_id}/suppliers/{supplier_id}/dossier", {
      params: { path },
    });
    degraded = (built.data?.degraded ?? []) as unknown as Degraded[];
    // A distinct header: Next memoises identical GETs within one render, which would replay
    // the pre-build answer.
    dossier = await api.GET("/orgs/{org_id}/suppliers/{supplier_id}/dossier", {
      params: { path },
      headers: { "X-QS-Read": "after-build" },
    });
    if (!dossier.data) notFound();
  }
  const labels = supplierLabels(locale);
  return (
    <div className="max-w-5xl space-y-3">
      <Link
        href={`/${locale}/suppliers`}
        className="text-sm text-link underline-offset-2 hover:underline"
      >
        ← {labels.back}
      </Link>
      <DossierView
        dossier={dossier.data}
        labels={labels}
        locale={locale}
        canDecide={DECIDERS.has(org.role)}
        degraded={degraded}
      />
      {DECIDERS.has(org.role) && (
        <Card>
          <CardHeader>
            <CardTitle>{onboardingLabels(locale).invite}</CardTitle>
          </CardHeader>
          <CardBody>
            <InviteForm supplierId={id} labels={onboardingLabels(locale)} locale={locale} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
