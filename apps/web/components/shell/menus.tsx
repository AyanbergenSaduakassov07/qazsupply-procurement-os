"use client";

import type { Locale } from "@qazsupply/i18n";
import { Badge } from "@qazsupply/ui/components/badge";
import { cn } from "@qazsupply/ui/lib/utils";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { setCurrentOrg, setReduceTransparency, signOut } from "../../app/actions";

import {
  AuditIcon,
  BellIcon,
  BuildingIcon,
  CheckIcon,
  ChevronDownIcon,
  GlobeIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  TransparencyIcon,
  UserIcon,
} from "./icons";

const contentClass =
  "z-50 min-w-56 rounded-[var(--qs-radius-md)] border border-line bg-surface p-1 shadow-[var(--qs-elevation-3)]";
const itemClass =
  "flex cursor-pointer items-center gap-2 rounded-[var(--qs-radius-sm)] px-2.5 py-2 text-sm text-ink outline-none data-[highlighted]:bg-surface-raised";
const labelClass = "px-2.5 py-1.5 text-xs font-medium text-muted";

function Trigger({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu.Trigger
      aria-label={label}
      className={cn(
        "inline-flex h-9 min-h-9 items-center gap-1.5 rounded-[var(--qs-radius-md)] px-2.5 text-sm text-ink",
        "hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)]",
      )}
    >
      {children}
    </DropdownMenu.Trigger>
  );
}

/* ------------------------------------------------------------------ theme */
export function ThemeMenu({
  labels,
}: {
  labels: {
    label: string;
    light: string;
    dark: string;
    system: string;
    reduce: string;
    reduceHint: string;
  };
}) {
  const { theme, setTheme } = useTheme();
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(document.documentElement.dataset.reduceTransparency === "true");
  }, []);

  const applyReduce = async (next: boolean) => {
    setReduce(next);
    const root = document.documentElement;
    if (next) root.dataset.reduceTransparency = "true";
    else delete root.dataset.reduceTransparency;
    await setReduceTransparency(next);
  };

  return (
    <DropdownMenu.Root>
      <Trigger label={labels.label}>
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
      </Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={contentClass}>
          <DropdownMenu.Label className={labelClass}>{labels.label}</DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={theme ?? "system"}
            onValueChange={(value) => setTheme(value)}
          >
            <DropdownMenu.RadioItem className={itemClass} value="light">
              <SunIcon />
              <span className="flex-1">{labels.light}</span>
              <RadioDot selected={theme === "light"} />
            </DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem className={itemClass} value="dark">
              <MoonIcon />
              <span className="flex-1">{labels.dark}</span>
              <RadioDot selected={theme === "dark"} />
            </DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem className={itemClass} value="system">
              <MonitorIcon />
              <span className="flex-1">{labels.system}</span>
              <RadioDot selected={theme === "system"} />
            </DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.CheckboxItem
            className={itemClass}
            checked={reduce}
            onCheckedChange={(checked) => void applyReduce(checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            <TransparencyIcon />
            <span className="flex-1">
              <span className="block">{labels.reduce}</span>
              <span className="block text-xs text-muted">{labels.reduceHint}</span>
            </span>
            <RadioDot selected={reduce} />
          </DropdownMenu.CheckboxItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  return <CheckIcon className={selected ? "text-link" : "opacity-0"} />;
}

/* --------------------------------------------------------------- language */
export function LanguageMenu({
  labels,
  languages,
  current,
}: {
  labels: { label: string };
  languages: { locale: Locale; name: string }[];
  current: Locale;
}) {
  const pathname = usePathname();
  const swap = (locale: Locale) => {
    const segments = pathname.split("/");
    segments[1] = locale;
    return segments.join("/") || `/${locale}`;
  };

  return (
    <DropdownMenu.Root>
      <Trigger label={labels.label}>
        <GlobeIcon />
      </Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={contentClass}>
          <DropdownMenu.Label className={labelClass}>{labels.label}</DropdownMenu.Label>
          {languages.map(({ locale, name }) => (
            <DropdownMenu.Item key={locale} className={itemClass} asChild>
              <a href={swap(locale)} lang={locale} hrefLang={locale}>
                <span className="flex-1">{name}</span>
                <RadioDot selected={locale === current} />
              </a>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* ---------------------------------------------------------- notifications */
export function NotificationsMenu({
  labels,
}: {
  labels: { title: string; open: string; empty: string; emptyHint: string };
}) {
  return (
    <DropdownMenu.Root>
      <Trigger label={labels.open}>
        <BellIcon />
      </Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={contentClass}>
          <DropdownMenu.Label className={labelClass}>{labels.title}</DropdownMenu.Label>
          <div className="px-2.5 py-6 text-center">
            <p className="text-sm text-ink">{labels.empty}</p>
            <p className="mt-1 text-xs text-muted">{labels.emptyHint}</p>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* ------------------------------------------------------------------ org */
export function OrgMenu({
  labels,
  orgs,
  currentId,
}: {
  labels: { label: string; none: string; noneHint: string };
  orgs: { id: string; name: string; role: string }[];
  currentId?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const active = orgs.find((o) => o.id === currentId) ?? orgs[0];
  const choose = (id: string) =>
    startTransition(async () => {
      await setCurrentOrg(id);
      router.refresh();
    });
  return (
    <DropdownMenu.Root>
      <Trigger label={active ? `${labels.label}: ${active.name}` : labels.label}>
        <BuildingIcon />
        <span className="hidden max-w-40 truncate sm:inline">
          {active ? active.name : labels.none}
        </span>
        <ChevronDownIcon className="opacity-60" />
      </Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} className={contentClass}>
          <DropdownMenu.Label className={labelClass}>{labels.label}</DropdownMenu.Label>
          {orgs.length === 0 ? (
            <div className="px-2.5 py-3">
              <p className="text-sm text-ink">{labels.none}</p>
              <p className="mt-1 text-xs text-muted">{labels.noneHint}</p>
            </div>
          ) : (
            <DropdownMenu.RadioGroup value={active?.id} onValueChange={choose}>
              {orgs.map((org) => (
                <DropdownMenu.RadioItem key={org.id} value={org.id} className={itemClass}>
                  <RadioDot selected={org.id === active?.id} />
                  <span className="flex-1">{org.name}</span>
                  <Badge variant="neutral">{org.role}</Badge>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* -------------------------------------------------------------- account */
export function AccountMenu({
  labels,
  email,
  signedIn,
  locale,
}: {
  locale: Locale;
  labels: { menu: string; signedInAs: string; signOut: string; notAvailable: string };
  email?: string;
  signedIn: boolean;
}) {
  return (
    <DropdownMenu.Root>
      <Trigger label={labels.menu}>
        <UserIcon />
      </Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={contentClass}>
          <DropdownMenu.Label className={labelClass}>{labels.menu}</DropdownMenu.Label>
          {signedIn ? (
            <>
              <div className="px-2.5 py-2">
                <p className="text-xs text-muted">{labels.signedInAs}</p>
                <p className="truncate text-sm text-ink">{email}</p>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item className={itemClass} onSelect={() => signOut(locale)}>
                <span>{labels.signOut}</span>
              </DropdownMenu.Item>
            </>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-3 text-sm text-muted">
              <AuditIcon />
              <span>{labels.notAvailable}</span>
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
