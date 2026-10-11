/**
 * The client report as data: ranking, totals and the "what to do" summary. Shared by the screen
 * and the PDF so both show the same figures from the same arithmetic. No imports: it runs under
 * `node --test` directly. Money is summed in tiyn (integers), never as floats.
 */

export type FindingType =
  | "price_variance"
  | "outlier"
  | "repeat_purchase"
  | "split_purchase"
  | "concentration";

export interface ModelFinding {
  id: string;
  type: string;
  saving_estimate: string;
  confidence: string;
  method: string;
  item_name: string | null;
  enstru_code: string | null;
  supplier_name: string | null;
  evidence_id: string | null;
  decision: "approve" | "edit" | "reject" | null;
  decision_note: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
}

export interface TypeTotal {
  type: string;
  count: number;
  tiyn: number;
}

export interface ReportModel {
  /** Kept findings, highest saving first, then highest confidence. */
  ranked: ModelFinding[];
  top: ModelFinding[];
  rest: ModelFinding[];
  totalTiyn: number;
  byType: TypeTotal[];
}

export const toTiyn = (amount: string): number => Math.round(Number(amount) * 100);

export function buildReportModel(findings: ModelFinding[], topN = 5): ReportModel {
  const ranked = findings
    .filter((f) => f.decision !== "reject")
    .sort(
      (a, b) =>
        toTiyn(b.saving_estimate) - toTiyn(a.saving_estimate) ||
        Number(b.confidence) - Number(a.confidence) ||
        a.id.localeCompare(b.id),
    );
  const types = new Map<string, TypeTotal>();
  for (const f of ranked) {
    const t = types.get(f.type) ?? { type: f.type, count: 0, tiyn: 0 };
    t.count += 1;
    t.tiyn += toTiyn(f.saving_estimate);
    types.set(f.type, t);
  }
  return {
    ranked,
    top: ranked.slice(0, topN),
    rest: ranked.slice(topN),
    totalTiyn: ranked.reduce((sum, f) => sum + toTiyn(f.saving_estimate), 0),
    byType: [...types.values()].sort((a, b) => b.tiyn - a.tiyn || a.type.localeCompare(b.type)),
  };
}

/** Fill `{name}` placeholders; unknown names become empty. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
}

export function localeTag(locale: string): string {
  return locale === "kk" ? "kk-KZ" : locale === "ru" ? "ru-RU" : "en-GB";
}

const NBSP = "\u00a0";

/**
 * One money format for screen and PDF, independent of the runtime's locale data (browsers ship
 * partial Kazakh ICU data: Intl renders "KZT 297,500" in some and "297 500 ₸" in others).
 * kk/ru: "297 500 ₸" (no-break spaces); en: "₸297,500". Whole tenge, half away from zero.
 */
export function moneyFormatter(locale: string): (tiyn: number) => string {
  return (tiyn) => {
    const tenge = Math.round(Math.abs(tiyn) / 100);
    const sign = tiyn < 0 && tenge > 0 ? "-" : "";
    const digits = String(tenge).replace(/\B(?=(\d{3})+(?!\d))/g, locale === "en" ? "," : NBSP);
    return locale === "en" ? `${sign}₸${digits}` : `${sign}${digits}${NBSP}₸`;
  };
}

export function percent(confidence: string): string {
  return `${Math.round(Number(confidence) * 100)}%`;
}

const MONTHS: Record<string, string[]> = {
  kk: [
    "қаңтар",
    "ақпан",
    "наурыз",
    "сәуір",
    "мамыр",
    "маусым",
    "шілде",
    "тамыз",
    "қыркүйек",
    "қазан",
    "қараша",
    "желтоқсан",
  ],
  ru: [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

/** Dates in the same words everywhere (see moneyFormatter). Calendar day in Asia/Almaty. */
export function dateFormatter(locale: string): (iso: string) => string {
  const months = MONTHS[locale] ?? MONTHS.ru ?? [];
  return (iso) => {
    // Date-only values are calendar days; timestamps are shown as the day in Almaty (UTC+5).
    const date = /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? new Date(`${iso}T00:00:00Z`)
      : new Date(new Date(iso).getTime() + 5 * 3_600_000);
    const [d, m, y] = [date.getUTCDate(), months[date.getUTCMonth()] ?? "", date.getUTCFullYear()];
    if (locale === "kk") return `${y} ж. ${d} ${m}`;
    if (locale === "en") return `${d} ${m} ${y}`;
    return `${d} ${m} ${y} г.`;
  };
}
