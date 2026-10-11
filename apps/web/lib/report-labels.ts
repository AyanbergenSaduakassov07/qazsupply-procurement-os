import { type Locale, type MessageKey, t } from "@qazsupply/i18n";

import type { NarrativeLabels } from "../components/report/report-narrative";
import type { PdfLabels } from "../components/report/report-pdf";
import { findingsLabels } from "./spend-labels";

const TYPES = [
  "price_variance",
  "outlier",
  "repeat_purchase",
  "split_purchase",
  "concentration",
] as const;

export function narrativeLabels(locale: Locale): NarrativeLabels {
  const r = (k: string) => t(locale, `report.${k}` as MessageKey);
  const findings = findingsLabels(locale);
  return {
    headline: r("headline"),
    headlineHint: r("headlineHint"),
    headlineEvidence: r("headlineEvidence"),
    parts: r("parts"),
    period: r("period"),
    reviewedBy: r("reviewedBy"),
    reviewedByUnknown: r("reviewedByUnknown"),
    reviewed: r("reviewed"),
    notReleased: r("notReleased"),
    top: r("top"),
    all: r("all"),
    confidence: r("confidence"),
    note: r("note"),
    action: r("action"),
    actions: Object.fromEntries(TYPES.map((k) => [k, r(`action.${k}`)])),
    byType: r("byType"),
    byTypeDescription: r("byTypeDescription"),
    byTypeTable: r("byTypeTable"),
    colType: r("colType"),
    colCount: r("colCount"),
    colSaving: r("colSaving"),
    colShare: r("colShare"),
    todo: r("todo"),
    todoLabels: Object.fromEntries(TYPES.map((k) => [k, r(`todo.${k}`)])),
    todoLine: r("todoLine"),
    downloadPdf: r("downloadPdf"),
    openEvidence: findings.openEvidence,
    sample: t(locale, "review.sample"),
    types: findings.types,
    none: findings.none,
    noneHint: findings.noneHint,
    drawer: findings.drawer,
  };
}

export function pdfLabels(locale: Locale): PdfLabels {
  return {
    ...narrativeLabels(locale),
    page: t(locale, "report.pdf.page"),
    footer: t(locale, "report.pdf.footer"),
    evidence: t(locale, "report.pdf.evidence"),
    howToCheck: t(locale, "report.pdf.howToCheck"),
  };
}
