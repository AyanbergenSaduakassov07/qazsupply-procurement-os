import { isLocale } from "@qazsupply/i18n";
import { notFound } from "next/navigation";

import { RfqBuilder } from "../../../../../components/procurement/rfq-builder";
import { procLabels } from "../../../../../lib/procurement-labels";
import { procRole } from "../../../../../lib/procurement-role";
import { getSession } from "../../../../../lib/session";

export default async function NewRfqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  const org = session.status === "authenticated" ? session.currentOrg : null;
  const role = procRole(org?.role);
  if (!org || (role !== "buyer" && role !== "approver")) notFound();
  const l = procLabels(locale);
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-ink">{l.builder}</h1>
      <RfqBuilder l={l} locale={locale} />
    </div>
  );
}
