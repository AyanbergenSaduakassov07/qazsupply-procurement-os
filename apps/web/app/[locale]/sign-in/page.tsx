import { isLocale, t } from "@qazsupply/i18n";
import { Button } from "@qazsupply/ui/components/button";
import { Card, CardBody, CardHeader } from "@qazsupply/ui/components/card";
import { notFound, redirect } from "next/navigation";
import { getSession } from "../../../lib/session";
import { signIn } from "../../actions";

const inputClass =
  "mt-1 block min-h-11 w-full rounded-[var(--qs-radius-md)] border border-line bg-surface px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)]";

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if ((await getSession()).status === "authenticated") redirect(`/${locale}`);
  const { error } = await searchParams;
  const message =
    error === "invalid"
      ? t(locale, "auth.error")
      : error === "unavailable"
        ? t(locale, "auth.unavailable")
        : null;

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <p className="mb-6 text-base font-semibold text-ink">{t(locale, "app.name")}</p>
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold text-ink">{t(locale, "auth.title")}</h1>
        </CardHeader>
        <CardBody>
          <p className="mb-4 text-sm text-muted">{t(locale, "auth.intro")}</p>
          {message && (
            <p
              role="alert"
              className="mb-4 rounded-[var(--qs-radius-md)] border border-risk px-3 py-2 text-sm text-risk"
            >
              {message}
            </p>
          )}
          <form action={signIn} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <label className="block text-sm text-ink">
              {t(locale, "auth.email")}
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                className={inputClass}
              />
            </label>
            <label className="block text-sm text-ink">
              {t(locale, "auth.password")}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={inputClass}
              />
            </label>
            <Button type="submit" className="w-full">
              {t(locale, "auth.submit")}
            </Button>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
