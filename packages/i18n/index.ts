import en from "./messages/en.json";
import kk from "./messages/kk.json";
import ru from "./messages/ru.json";

export const locales = ["kk", "ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ru";

export type MessageKey = keyof typeof ru;
const catalogs: Record<Locale, Record<MessageKey, string>> = { kk, ru, en };

export const isLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

export const t = (locale: Locale, key: MessageKey): string => catalogs[locale][key];

/** Every message under `prefix.` with the prefix stripped (for one screen's labels). */
export function group(locale: Locale, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(catalogs[locale]) as MessageKey[]) {
    if (key.startsWith(`${prefix}.`)) out[key.slice(prefix.length + 1)] = catalogs[locale][key];
  }
  return out;
}
