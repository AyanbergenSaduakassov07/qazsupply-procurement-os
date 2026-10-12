import { type Locale, type MessageKey, t } from "@qazsupply/i18n";

const KEYS = [
  "title",
  "intro",
  "none",
  "noneHint",
  "forSupplier",
  "step",
  "step1",
  "step2",
  "step3",
  "legalName",
  "bin",
  "binHint",
  "contactName",
  "contactPhone",
  "save",
  "back",
  "next",
  "kind",
  "file",
  "docNumber",
  "issuedOn",
  "confirmFields",
  "confirmHint",
  "upload",
  "uploaded",
  "docs",
  "noDocs",
  "confirmed",
  "notConfirmed",
  "download",
  "declare",
  "submit",
  "submittedHint",
  "returned",
  "decisionNote",
  "invite",
  "inviteEmail",
  "inviteSend",
  "inviteDone",
  "cases",
  "review",
  "approve",
  "reject",
  "return",
  "note",
  "noteHint",
  "humanCheck",
  "decided",
] as const; // prettier-ignore
export const KINDS = ["registration_certificate", "charter", "bank_letter", "other"] as const;
export const STATUSES = ["invited", "in_progress", "submitted", "approved", "rejected"] as const;
const ERRORS = [
  "details_incomplete",
  "document_required",
  "unsupported_file_type",
  "too_large",
  "empty",
  "locked_for_supplier",
  "not_a_supplier_member",
  "note_required",
] as const; // prettier-ignore

const group = (locale: Locale, prefix: string, keys: readonly string[]) =>
  Object.fromEntries(keys.map((k) => [k, t(locale, `ob.${prefix}.${k}` as MessageKey)]));

export function onboardingLabels(locale: Locale) {
  return {
    ...(Object.fromEntries(KEYS.map((k) => [k, t(locale, `ob.${k}` as MessageKey)])) as Record<
      (typeof KEYS)[number],
      string
    >),
    kindName: group(locale, "kind", KINDS),
    status: group(locale, "status", STATUSES),
    errors: { ...group(locale, "error", ERRORS), unexpected: t(locale, "common.error") } as Record<
      string,
      string
    >,
  };
}
export type OnboardingLabels = ReturnType<typeof onboardingLabels>;
