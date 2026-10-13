import { group, type Locale, t } from "@qazsupply/i18n";

/** Flat labels for the procurement screens: `l["status.sent"]`, `l["cmp.flip"]`, ... */
export function procLabels(locale: Locale): Record<string, string> {
  return {
    ...group(locale, "p"),
    error: t(locale, "common.error"),
  };
}

export const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
