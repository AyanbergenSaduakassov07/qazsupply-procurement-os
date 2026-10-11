import { type Locale, type MessageKey, t } from "@qazsupply/i18n";

import type { FindingsLabels } from "../components/spend/findings-view";
import type { ReviewLabels } from "../components/spend/review-queue";
import type { UploadLabels } from "../components/spend/upload-wizard";

const FIELDS = [
  "item_text",
  "quantity",
  "unit",
  "unit_price",
  "total",
  "currency",
  "purchased_on",
  "supplier_text",
  "supplier_bin",
] as const;
const FILE_ERRORS = [
  "too_large",
  "empty",
  "unsupported_type",
  "unreadable",
  "macros",
  "encoding",
  "too_many_rows",
  "bad_mapping",
  "forbidden",
] as const;
const ROW_ERRORS = [
  "missing_item",
  "missing_date",
  "bad_date",
  "bad_number",
  "missing_price",
  "negative_price",
  "unknown_currency",
] as const;
const FINDING_TYPES = [
  "price_variance",
  "outlier",
  "repeat_purchase",
  "split_purchase",
  "concentration",
] as const;

const map = <K extends string>(locale: Locale, prefix: string, keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, t(locale, `${prefix}.${k}` as MessageKey)])) as Record<
    K,
    string
  >;

export function uploadLabels(locale: Locale): UploadLabels {
  const tt = (k: string) => t(locale, `upload.${k}` as MessageKey);
  return {
    title: tt("title"),
    drop: tt("drop"),
    choose: tt("choose"),
    reading: tt("reading"),
    mapping: tt("mapping"),
    mappingHint: tt("mappingHint"),
    none: t(locale, "upload.field.none"),
    required: tt("required"),
    sample: tt("sample"),
    rowsTotal: tt("rowsTotal"),
    checks: tt("checks"),
    confirm: tt("confirm"),
    importing: tt("importing"),
    done: tt("done"),
    inserted: tt("inserted"),
    rejected: tt("rejected"),
    duplicate: tt("duplicate"),
    matched: tt("matched"),
    toReview: tt("toReview"),
    goReview: tt("goReview"),
    another: tt("another"),
    skippedRows: tt("skippedRows"),
    retry: t(locale, "common.retry"),
    errorTitle: t(locale, "common.error"),
    fields: map(locale, "upload.field", FIELDS),
    fileErrors: {
      ...map(locale, "ingest.error", FILE_ERRORS),
      unexpected: t(locale, "common.error"),
    },
    rowErrors: map(locale, "ingest.row", ROW_ERRORS),
    rowErrorsShort: map(locale, "ingest.short", ROW_ERRORS),
  };
}

export function reviewLabels(locale: Locale): ReviewLabels {
  const tt = (k: string) => t(locale, `review.${k}` as MessageKey);
  return {
    sample: tt("sample"),
    sampleHint: tt("sampleHint"),
    empty: tt("empty"),
    emptyHint: tt("emptyHint"),
    why: tt("why"),
    matched: tt("matched"),
    score: tt("score"),
    accept: tt("accept"),
    reject: tt("reject"),
    choose: tt("choose"),
    undo: tt("undo"),
    keys: tt("keys"),
    bundled: tt("bundled"),
    bundledHint: tt("bundledHint"),
    saved: tt("saved"),
    undone: tt("undone"),
    row: tt("row"),
    file: tt("file"),
    noCandidates: tt("noCandidates"),
    selectLine: tt("selectLine"),
    acceptSelected: tt("acceptSelected"),
    selected: tt("selected"),
    error: t(locale, "common.error"),
    listLabel: tt("title"),
  };
}

export function findingsLabels(locale: Locale): FindingsLabels {
  const tt = (k: string) => t(locale, `findings.${k}` as MessageKey);
  const g = (k: string) => t(locale, `gallery.${k}` as MessageKey);
  return {
    total: tt("total"),
    saving: tt("saving"),
    confidence: tt("confidence"),
    method: tt("method"),
    openEvidence: tt("openEvidence"),
    item: tt("item"),
    supplier: tt("supplier"),
    type: tt("type"),
    types: map(locale, "findings.type", FINDING_TYPES),
    assumption: tt("assumption"),
    noSaving: tt("noSaving"),
    none: tt("none"),
    noneHint: tt("noneHint"),
    error: tt("error"),
    drawer: {
      title: g("evidenceTitle"),
      method: g("method"),
      confidence: g("confidence"),
      version: g("version"),
      computation: g("computation"),
      sources: g("sources"),
      empty: t(locale, "common.loading"),
      close: t(locale, "common.close"),
      file: g("file"),
      row: g("row"),
      item: g("item"),
      supplier: g("supplier"),
      qty: g("qty"),
      price: g("price"),
      date: g("date"),
    },
  };
}

export function analysisErrors(locale: Locale): Record<string, string> {
  return {
    staff_only: t(locale, "findings.staffOnly"),
    savings_cross_check_failed: t(locale, "findings.error"),
    unexpected: t(locale, "common.error"),
  };
}
