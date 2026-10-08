"use client";

import type { Locale } from "@qazsupply/i18n";
import { cn } from "@qazsupply/ui/lib/utils";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { setReduceTransparency } from "../../app/actions";

type ThemeValue = "light" | "dark" | "system";

const optionClass =
  "flex cursor-pointer items-center gap-2 rounded-[var(--qs-radius-md)] border border-line px-3 py-2 text-sm text-ink has-[:checked]:border-[var(--qs-focus)] has-[:checked]:font-medium";

export function SettingsControls({
  labels,
  languages,
  current,
}: {
  labels: {
    appearance: string;
    light: string;
    dark: string;
    system: string;
    language: string;
    reduce: string;
    reduceHint: string;
  };
  languages: { locale: Locale; name: string }[];
  current: Locale;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setMounted(true);
    setReduce(document.documentElement.dataset.reduceTransparency === "true");
  }, []);
  const toggleReduce = (next: boolean) => {
    setReduce(next);
    if (next) document.documentElement.dataset.reduceTransparency = "true";
    else delete document.documentElement.dataset.reduceTransparency;
    void setReduceTransparency(next);
  };

  const value: ThemeValue = mounted ? ((theme as ThemeValue) ?? "system") : "system";
  const themes: { value: ThemeValue; label: string }[] = [
    { value: "light", label: labels.light },
    { value: "dark", label: labels.dark },
    { value: "system", label: labels.system },
  ];

  const swap = (locale: Locale) => {
    const segments = pathname.split("/");
    segments[1] = locale;
    return segments.join("/") || `/${locale}`;
  };

  return (
    <div className="grid gap-6" suppressHydrationWarning>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{labels.appearance}</legend>
        <div className="flex flex-wrap gap-2">
          {themes.map((option) => (
            <label key={option.value} className={optionClass}>
              <input
                type="radio"
                name="qs-theme"
                value={option.value}
                checked={value === option.value}
                onChange={() => setTheme(option.value)}
                className="accent-[var(--qs-accent-strong)]"
              />
              {option.label}
            </label>
          ))}
        </div>
        <label className={cn(optionClass, "mt-2 w-full")}>
          <input
            type="checkbox"
            checked={reduce}
            onChange={(e) => toggleReduce(e.target.checked)}
            className="accent-[var(--qs-accent-strong)]"
          />
          <span>
            <span className="block">{labels.reduce}</span>
            <span className="block text-xs text-muted">{labels.reduceHint}</span>
          </span>
        </label>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{labels.language}</legend>
        <div className="flex flex-wrap gap-2">
          {languages.map(({ locale, name }) => (
            <a
              key={locale}
              href={swap(locale)}
              lang={locale}
              hrefLang={locale}
              aria-current={locale === current ? "true" : undefined}
              className={cn(
                "rounded-[var(--qs-radius-md)] border px-3 py-2 text-sm",
                locale === current
                  ? "border-[var(--qs-focus)] font-medium text-ink"
                  : "border-line text-muted hover:text-ink",
              )}
            >
              {name}
            </a>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
