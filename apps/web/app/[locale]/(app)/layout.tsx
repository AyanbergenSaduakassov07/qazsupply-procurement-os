import { isLocale } from "@qazsupply/i18n";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "../../../components/shell/app-shell";
import { getSession } from "../../../lib/session";

/** Every page in this group needs a signed-in user; the shell renders the active org's view. */
export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  if (session.status === "anonymous") redirect(`/${locale}/sign-in`);
  if (session.status === "unavailable") redirect(`/${locale}/sign-in?error=unavailable`);
  return (
    <AppShell locale={locale} session={session}>
      {children}
    </AppShell>
  );
}
