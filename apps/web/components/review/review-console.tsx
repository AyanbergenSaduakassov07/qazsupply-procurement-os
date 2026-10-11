"use client";

import { Badge } from "@qazsupply/ui/components/badge";
import { Button } from "@qazsupply/ui/components/button";
import { Card, CardBody } from "@qazsupply/ui/components/card";
import { EvidenceDrawer, type EvidenceDrawerProps } from "@qazsupply/ui/components/evidence-drawer";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { decideFinding, reviewStep } from "../../app/review-actions";
import { loadEvidence } from "../../app/spend-actions";

type Decision = "approve" | "edit" | "reject";

export interface ConsoleReport {
  id: string;
  title: string;
  status: string;
  submitted_at: string | null;
  released_at: string | null;
  findings: number;
  undecided: number;
  total_saving: string;
  four_eyes: boolean;
}

export interface ConsoleFinding {
  id: string;
  type: string;
  saving_estimate: string;
  confidence: string;
  method: string;
  item_name: string | null;
  enstru_code: string | null;
  supplier_name: string | null;
  evidence_id: string | null;
  decision: Decision | null;
  decision_note: string | null;
}

export interface ConsoleEntry {
  id: string;
  finding_id: string | null;
  reviewer_id: string;
  decision: Decision;
  note: string | null;
  created_at: string;
}

export interface ConsoleLabels {
  status: Record<string, string>;
  types: Record<string, string>;
  decisions: Record<Decision, string>;
  undecided: string;
  decided: string; // "{done} of {total} findings decided"
  kept: string;
  sla: string; // "In review for {hours} h (target {target} h)"
  overdue: string;
  submit: string;
  returnToDraft: string;
  approve: string;
  approveBlocked: string;
  reject: string;
  reopen: string;
  release: string;
  releaseConfirm: string;
  cancel: string;
  save: string;
  keep: string;
  keepWithNote: string;
  rejectFinding: string;
  note: string;
  noteRequired: string;
  noteVisible: string;
  closed: string;
  fourEyes: string;
  keys: string;
  history: string;
  historyEmpty: string;
  reportLevel: string;
  openEvidence: string;
  listLabel: string;
  errors: Record<string, string>;
  drawer: EvidenceDrawerProps["labels"];
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
}

function tag(locale: string): string {
  return locale === "kk" ? "kk-KZ" : locale === "ru" ? "ru-RU" : "en-GB";
}

export function ReviewConsole({
  report,
  findings,
  history,
  labels,
  locale,
  slaHours = 48,
}: {
  report: ConsoleReport;
  findings: ConsoleFinding[];
  history: ConsoleEntry[];
  labels: ConsoleLabels;
  locale: string;
  slaHours?: number;
}) {
  const router = useRouter();
  const money = new Intl.NumberFormat(tag(locale), {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  });
  const when = new Intl.DateTimeFormat(tag(locale), { dateStyle: "medium", timeStyle: "short" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState<{ id: string; decision: "edit" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const [reportNote, setReportNote] = useState<"approve" | "reject" | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceDrawerProps["evidence"]>(null);
  const [now, setNow] = useState(() => Date.now());
  const listRef = useRef<HTMLFieldSetElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (draft || reportNote) noteRef.current?.focus();
  }, [draft, reportNote]);

  const editable = report.status === "in_review";
  const closed = ["released", "rejected", "superseded"].includes(report.status);
  const done = report.findings - report.undecided;
  const hours = report.submitted_at
    ? Math.floor((now - new Date(report.submitted_at).getTime()) / 3_600_000)
    : null;
  const overdue = editable && hours !== null && hours >= slaHours;
  const byId = new Map(findings.map((f) => [f.id, f]));

  const finish = async (run: () => Promise<{ ok: boolean; code?: string }>) => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const result = await run();
    setBusy(false);
    if (!result.ok) {
      const code = "code" in result && result.code ? result.code : "unexpected";
      setError(labels.errors[code] ?? labels.errors.unexpected ?? code);
      return false;
    }
    setDraft(null);
    setReportNote(null);
    setConfirmRelease(false);
    setNote("");
    router.refresh();
    return true;
  };

  const decide = (f: ConsoleFinding, decision: Decision) => {
    if (decision !== "approve" && !note.trim()) {
      setError(labels.noteRequired);
      noteRef.current?.focus();
      return;
    }
    void finish(() => decideFinding(report.id, f.id, decision, note));
  };

  const step = (name: string, text?: string) =>
    void finish(() => reviewStep(report.id, name, text));

  const focusLine = (index: number) => {
    const next = Math.max(0, Math.min(index, findings.length - 1));
    setActive(next);
    listRef.current?.querySelectorAll<HTMLElement>("[data-finding]")[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLFieldSetElement>) => {
    if (e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey) return;
    const f = findings[active];
    const key = e.key.toLowerCase();
    if (key === "j" || e.key === "ArrowDown") focusLine(active + 1);
    else if (key === "k" || e.key === "ArrowUp") focusLine(active - 1);
    else if (editable && f && key === "a") decide(f, "approve");
    else if (editable && f && (key === "e" || key === "r")) {
      setNote(f.decision_note ?? "");
      setDraft({ id: f.id, decision: key === "e" ? "edit" : "reject" });
    } else return;
    e.preventDefault();
  };

  const showEvidence = async (f: ConsoleFinding) => {
    if (!f.evidence_id) return;
    setEvidence(null);
    setEvidenceOpen(true);
    const ev = await loadEvidence(f.evidence_id);
    if (!ev.ok) return;
    setEvidence({
      id: ev.id,
      computationId: ev.computation_id,
      method: labels.types[f.type] ?? f.type,
      codeVersion: ev.code_version,
      confidence: `${Math.round(Number(f.confidence) * 100)}%`,
      formula: f.method,
      result: ev.result != null ? money.format(ev.result) : undefined,
      sources: ev.sources.map((s) => ({
        id: s.purchase_line_id,
        fileName: s.file_name,
        sourceRow: s.source_row,
        itemText: s.item_text ?? undefined,
        supplierText: s.supplier_text ?? undefined,
        quantity: s.quantity != null ? String(s.quantity) : undefined,
        unitPrice: s.unit_price != null ? String(s.unit_price) : undefined,
        currency: s.currency ?? undefined,
        purchasedOn: s.purchased_on ?? undefined,
      })),
    });
  };

  const noteForm = (onSave: () => void, required: boolean) => (
    <div className="mt-3 space-y-2">
      <label className="block text-sm text-ink" htmlFor={`note-${report.id}`}>
        {labels.note}
        {required ? " *" : ""}
      </label>
      <textarea
        id={`note-${report.id}`}
        ref={noteRef}
        value={note}
        maxLength={2000}
        rows={3}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(null);
            setReportNote(null);
          }
        }}
        aria-describedby={`note-hint-${report.id}`}
        className="w-full rounded-md border border-line bg-surface p-2 text-base text-ink"
      />
      <p id={`note-hint-${report.id}`} className="text-xs text-muted">
        {labels.noteVisible}
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={busy}>
          {labels.save}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setDraft(null);
            setReportNote(null);
          }}
        >
          {labels.cancel}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={closed ? "neutral" : "gold"} data-testid="report-status">
              {labels.status[report.status] ?? report.status}
            </Badge>
            {report.four_eyes && <Badge variant="neutral">{labels.fourEyes}</Badge>}
            {hours !== null && editable && (
              <Badge variant={overdue ? "risk" : "neutral"} data-testid="sla">
                {fill(labels.sla, { hours, target: slaHours })}
                {overdue ? ` · ${labels.overdue}` : ""}
              </Badge>
            )}
          </div>
          <p className="text-sm text-ink" data-testid="decided">
            {fill(labels.decided, { done, total: report.findings })}
          </p>
          <p className="text-sm text-muted">
            {labels.kept}:{" "}
            <span className="font-semibold text-ink tabular-nums">
              {money.format(Number(report.total_saving))}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {report.status === "draft" && (
              <Button onClick={() => step("submit")} disabled={busy}>
                {labels.submit}
              </Button>
            )}
            {editable && (
              <>
                <Button
                  onClick={() => {
                    setNote("");
                    setReportNote("approve");
                  }}
                  disabled={busy || report.undecided > 0}
                  aria-describedby={report.undecided > 0 ? "approve-blocked" : undefined}
                >
                  {labels.approve}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setNote("");
                    setReportNote("reject");
                  }}
                  disabled={busy}
                >
                  {labels.reject}
                </Button>
                <Button variant="ghost" onClick={() => step("return")} disabled={busy}>
                  {labels.returnToDraft}
                </Button>
              </>
            )}
            {report.status === "approved" &&
              (confirmRelease ? (
                <>
                  <Button
                    onClick={() => step("release")}
                    disabled={busy}
                    data-testid="release-confirm"
                  >
                    {labels.releaseConfirm}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmRelease(false)}>
                    {labels.cancel}
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => setConfirmRelease(true)} disabled={busy}>
                    {labels.release}
                  </Button>
                  <Button variant="secondary" onClick={() => step("reopen")} disabled={busy}>
                    {labels.reopen}
                  </Button>
                </>
              ))}
          </div>
          {editable && report.undecided > 0 && (
            <p id="approve-blocked" className="text-xs text-muted">
              {fill(labels.approveBlocked, { count: report.undecided })}
            </p>
          )}
          {reportNote &&
            noteForm(
              () =>
                reportNote === "reject" && !note.trim()
                  ? setError(labels.noteRequired)
                  : step(reportNote, note),
              reportNote === "reject",
            )}
          {closed && <p className="text-sm text-muted">{labels.closed}</p>}
          <p role="alert" className="text-sm text-[var(--qs-risk)]" data-testid="review-error">
            {error}
          </p>
        </CardBody>
      </Card>

      <p id="console-keys" className="text-xs text-muted">
        {labels.keys}
      </p>
      <fieldset
        ref={listRef}
        onKeyDown={onKeyDown}
        aria-describedby="console-keys"
        className="space-y-3 border-0 p-0"
      >
        <legend className="sr-only">{labels.listLabel}</legend>
        {findings.map((f, i) => {
          const saving = Number(f.saving_estimate);
          return (
            <article
              key={f.id}
              data-finding
              data-testid="console-finding"
              tabIndex={i === active ? 0 : -1}
              onFocus={() => setActive(i)}
              aria-label={`${labels.types[f.type] ?? f.type}: ${f.item_name ?? ""}`}
              className={`rounded-[var(--qs-card-radius)] border bg-surface p-4 outline-none focus-visible:outline-2 focus-visible:outline-[var(--qs-focus)] ${
                i === active ? "border-[var(--qs-focus)]" : "border-line"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{labels.types[f.type] ?? f.type}</p>
                  <p className="mt-1 text-sm text-ink">
                    {f.item_name}
                    {f.enstru_code && (
                      <span className="ml-2 font-mono text-xs text-muted">{f.enstru_code}</span>
                    )}
                  </p>
                  {f.supplier_name && <p className="text-xs text-muted">{f.supplier_name}</p>}
                  <p className="mt-2 text-xs text-muted">
                    <Badge
                      variant={f.decision === "reject" ? "risk" : f.decision ? "ok" : "neutral"}
                      data-testid="finding-decision"
                    >
                      {f.decision ? labels.decisions[f.decision] : labels.undecided}
                    </Badge>
                    {f.decision_note && <span className="ml-2">{f.decision_note}</span>}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void showEvidence(f)}
                  disabled={!f.evidence_id}
                  aria-label={`${labels.openEvidence}: ${money.format(saving)}`}
                  className="tabular-nums"
                >
                  {money.format(saving)}
                </Button>
              </div>
              {editable && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => decide(f, "approve")} disabled={busy}>
                    {labels.keep}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setNote(f.decision_note ?? "");
                      setDraft({ id: f.id, decision: "edit" });
                    }}
                    disabled={busy}
                  >
                    {labels.keepWithNote}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNote("");
                      setDraft({ id: f.id, decision: "reject" });
                    }}
                    disabled={busy}
                  >
                    {labels.rejectFinding}
                  </Button>
                </div>
              )}
              {draft?.id === f.id && noteForm(() => decide(f, draft.decision), true)}
            </article>
          );
        })}
      </fieldset>

      <section aria-labelledby="history-title" className="space-y-2">
        <h2 id="history-title" className="text-base font-semibold text-ink">
          {labels.history}
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">{labels.historyEmpty}</p>
        ) : (
          <ol className="space-y-2" data-testid="review-history">
            {history.map((h, i) => {
              const before = h.finding_id
                ? [...history.slice(0, i)].reverse().find((p) => p.finding_id === h.finding_id)
                : undefined;
              const target = h.finding_id ? byId.get(h.finding_id) : undefined;
              return (
                <li key={h.id} className="rounded-md border border-line p-3 text-sm">
                  <span className="text-xs text-muted tabular-nums">
                    {when.format(new Date(h.created_at))}
                  </span>{" "}
                  <span className="text-ink">
                    {h.finding_id
                      ? (target?.item_name ?? labels.types[target?.type ?? ""] ?? "")
                      : labels.reportLevel}
                    {": "}
                    {before && (
                      <>
                        <del className="text-muted">{labels.decisions[before.decision]}</del> {"→ "}
                      </>
                    )}
                    <strong>{labels.decisions[h.decision]}</strong>
                  </span>
                  {h.note && <p className="mt-1 text-muted">{h.note}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <EvidenceDrawer
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        evidence={evidence}
        labels={labels.drawer}
      />
    </div>
  );
}
