import { type Locale, type MessageKey, t } from "@qazsupply/i18n";

import type { ConsoleLabels } from "../components/review/review-console";
import { findingsLabels } from "./spend-labels";

const STATUSES = ["draft", "in_review", "approved", "released", "rejected", "superseded"] as const;
const ERRORS = [
  "transition_not_allowed",
  "report_not_in_review",
  "undecided_findings",
  "note_required",
  "approval_review_required",
  "rejection_review_required",
  "four_eyes_runner_cannot_approve",
  "four_eyes_approver_cannot_release",
  "report_closed",
  "report_frozen",
  "findings_frozen",
  "finding_not_in_report",
  "staff_only",
  "not_found",
  "unexpected",
] as const;

export function consoleLabels(locale: Locale): ConsoleLabels {
  const g = (k: string) => t(locale, `gate.${k}` as MessageKey);
  const findings = findingsLabels(locale);
  return {
    status: Object.fromEntries(
      STATUSES.map((s) => [s, t(locale, `report.status.${s}` as MessageKey)]),
    ),
    types: findings.types,
    decisions: {
      approve: g("decision.approve"),
      edit: g("decision.edit"),
      reject: g("decision.reject"),
    },
    undecided: g("undecided"),
    decided: g("decided"),
    kept: g("kept"),
    sla: g("sla"),
    overdue: g("overdue"),
    submit: g("submit"),
    returnToDraft: g("returnToDraft"),
    approve: g("approve"),
    approveBlocked: g("approveBlocked"),
    reject: g("reject"),
    reopen: g("reopen"),
    release: g("release"),
    releaseConfirm: g("releaseConfirm"),
    cancel: g("cancel"),
    save: g("save"),
    keep: g("keep"),
    keepWithNote: g("keepWithNote"),
    rejectFinding: g("rejectFinding"),
    note: g("note"),
    noteRequired: g("noteRequired"),
    noteVisible: g("noteVisible"),
    closed: g("closed"),
    fourEyes: g("fourEyes"),
    keys: g("keys"),
    history: g("history"),
    historyEmpty: g("historyEmpty"),
    reportLevel: g("reportLevel"),
    openEvidence: findings.openEvidence,
    listLabel: g("listLabel"),
    errors: Object.fromEntries(ERRORS.map((e) => [e, g(`error.${e}`)])),
    drawer: findings.drawer,
  };
}
