import { type Locale, t } from "@qazsupply/i18n";
import type { ReactNode } from "react";

import { type Role, visibleNav } from "../../lib/navigation";
import type { Session } from "../../lib/session";
import { AskEntry } from "./ask-entry";
import { AccountMenu, LanguageMenu, NotificationsMenu, OrgMenu, ThemeMenu } from "./menus";
import { MobileNav } from "./mobile-nav";
import { type NavLinkItem, NavLinks } from "./nav-links";

const LANGUAGES = [
  { locale: "kk" as const, name: "Қазақша" },
  { locale: "ru" as const, name: "Русский" },
  { locale: "en" as const, name: "English" },
];

export function AppShell({
  locale,
  session,
  children,
}: {
  locale: Locale;
  session: Session;
  children: ReactNode;
}) {
  // Navigation follows the role in the ACTIVE org only, never the union across orgs.
  const roles: Role[] = session.status === "authenticated" ? session.roles : [];

  const items: NavLinkItem[] = visibleNav(roles).map((item) => ({
    key: item.key,
    href: `/${locale}${item.path}`,
    label: t(locale, item.labelKey),
    disabled: item.disabled,
  }));

  const orgs =
    session.status === "authenticated"
      ? session.memberships.map((m) => ({
          id: m.org_id,
          name: m.org_name,
          role: t(locale, `role.${m.role}`),
        }))
      : [];

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only rounded-[var(--qs-radius-md)] bg-surface px-3 py-2 text-sm text-ink focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60]"
      >
        {t(locale, "skip.toContent")}
      </a>

      <header className="qs-glass sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-3 sm:px-4">
          <MobileNav
            items={[
              ...items,
              { key: "settings", href: `/${locale}/settings`, label: t(locale, "nav.settings") },
            ]}
            labels={{
              menu: t(locale, "nav.menu"),
              close: t(locale, "common.close"),
              notAvailable: t(locale, "common.notAvailable"),
            }}
          />
          <a
            href={`/${locale}`}
            className="mr-1 rounded-[var(--qs-radius-sm)] px-1 text-base font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)]"
          >
            {t(locale, "app.name")}
          </a>

          <div className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1">
            <div>
              <OrgMenu
                orgs={orgs}
                currentId={
                  session.status === "authenticated" ? session.currentOrg?.org_id : undefined
                }
                labels={{
                  label: t(locale, "org.label"),
                  none: t(locale, "org.none"),
                  noneHint: t(locale, "org.noneHint"),
                }}
              />
            </div>
            <AskEntry
              labels={{
                entry: t(locale, "ask.entry"),
                disabled: t(locale, "ask.disabled"),
                notAvailable: t(locale, "common.notAvailable"),
              }}
            />
            <NotificationsMenu
              labels={{
                title: t(locale, "notifications.title"),
                open: t(locale, "notifications.open"),
                empty: t(locale, "notifications.empty"),
                emptyHint: t(locale, "notifications.emptyHint"),
              }}
            />
            <div className="hidden items-center sm:flex">
              <ThemeMenu
                labels={{
                  label: t(locale, "theme.label"),
                  light: t(locale, "theme.light"),
                  dark: t(locale, "theme.dark"),
                  system: t(locale, "theme.system"),
                  reduce: t(locale, "theme.reduceTransparency"),
                  reduceHint: t(locale, "theme.reduceTransparency.hint"),
                }}
              />
              <LanguageMenu
                labels={{ label: t(locale, "nav.language") }}
                languages={LANGUAGES}
                current={locale}
              />
            </div>
            <AccountMenu
              locale={locale}
              signedIn={session.status === "authenticated"}
              email={session.status === "authenticated" ? (session.email ?? undefined) : undefined}
              labels={{
                menu: t(locale, "user.menu"),
                signedInAs: t(locale, "user.signedInAs"),
                signOut: t(locale, "user.signOut"),
                notAvailable: t(locale, "common.notAvailable"),
              }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] gap-6 px-3 py-6 sm:px-4">
        <aside className="hidden w-56 shrink-0 lg:block">
          <NavLinks
            items={items}
            notAvailable={t(locale, "common.notAvailable")}
            ariaLabel={t(locale, "nav.primary")}
          />
          <a
            href={`/${locale}/settings`}
            className="mt-2 block rounded-[var(--qs-radius-md)] px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-ink"
          >
            {t(locale, "nav.settings")}
          </a>
        </aside>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
