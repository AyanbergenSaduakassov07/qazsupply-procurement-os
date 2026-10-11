"use client";

import { animate, durations, stagger, useAnimeScope, useReducedMotion } from "@qazsupply/motion";
import { Badge } from "@qazsupply/ui/components/badge";
import { ConcentrationPareto } from "@qazsupply/ui/components/charts";
import { EvidenceDrawer, type EvidenceDrawerProps } from "@qazsupply/ui/components/evidence-drawer";
import { Kpi } from "@qazsupply/ui/components/kpi";
import { EmptyState } from "@qazsupply/ui/components/states";
import { useState } from "react";

import { loadEvidence } from "../../app/spend-actions";
import {
  buildReportModel,
  dateFormatter,
  fill,
  type ModelFinding,
  moneyFormatter,
  percent,
  toTiyn,
} from "../../lib/report-model";

export interface NarrativeReport {
  id: string;
  title: string;
  status: string;
  period_start: string;
  period_end: string;
  released_at: string | null;
  released_by_name: string | null;
  approved_by_name: string | null;
}

export interface NarrativeLabels {
  headline: string;
  headlineHint: string;
  headlineEvidence: string;
  parts: string;
  period: string;
  reviewedBy: string;
  reviewedByUnknown: string;
  reviewed: string;
  notReleased: string;
  top: string;
  all: string;
  confidence: string;
  note: string;
  action: string;
  actions: Record<string, string>;
  byType: string;
  byTypeDescription: string;
  byTypeTable: string;
  colType: string;
  colCount: string;
  colSaving: string;
  colShare: string;
  todo: string;
  todoLabels: Record<string, string>;
  todoLine: string;
  downloadPdf: string;
  openEvidence: string;
  sample: string;
  types: Record<string, string>;
  none: string;
  noneHint: string;
  drawer: EvidenceDrawerProps["labels"];
}

export function ReportNarrative({
  report,
  findings,
  labels,
  locale,
  pdfHref,
}: {
  report: NarrativeReport;
  findings: ModelFinding[];
  labels: NarrativeLabels;
  locale: string;
  pdfHref: string;
}) {
  const model = buildReportModel(findings);
  const money = moneyFormatter(locale);
  const date = dateFormatter(locale);
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceDrawerProps["evidence"]>(null);
  const reviewer = report.approved_by_name ?? report.released_by_name;

  // Staged reveal: headline, then sections. Transform + opacity only; instant under reduced motion.
  const root = useAnimeScope<HTMLDivElement>(
    (self) => {
      if (!self?.root) return;
      const parts = Array.from((self.root as HTMLElement).querySelectorAll("[data-reveal]"));
      parts.forEach((el, i) => {
        animate(el, {
          opacity: [0, 1],
          translateY: reduced ? [0, 0] : [8, 0],
          duration: reduced ? 0 : durations.micro,
          delay: reduced ? 0 : stagger(i) * 2,
          ease: "outQuad",
        });
      });
    },
    [reduced, model.ranked.length],
  );

  /** Evidence for a sum: the findings it adds up, each with its own Evidence id. */
  const showParts = (title: string, parts: ModelFinding[]) => {
    const tiyn = parts.reduce((sum, f) => sum + toTiyn(f.saving_estimate), 0);
    setEvidence({
      id: report.id,
      computationId: report.id,
      method: title,
      codeVersion: "report",
      confidence: "—",
      formula: labels.headlineEvidence,
      result: money(tiyn),
      reviewedBy: reviewer ?? undefined,
      parts: parts
        .filter((f) => f.evidence_id)
        .map((f) => ({
          label: `${labels.types[f.type] ?? f.type}: ${f.item_name ?? ""}`,
          value: money(toTiyn(f.saving_estimate)),
          evidenceId: f.evidence_id ?? "",
        })),
      sources: [],
    });
    setOpen(true);
  };

  const showFinding = async (f: ModelFinding) => {
    if (!f.evidence_id) return;
    setEvidence(null);
    setOpen(true);
    const ev = await loadEvidence(f.evidence_id);
    if (!ev.ok) return;
    setEvidence({
      id: ev.id,
      computationId: ev.computation_id,
      method: labels.types[f.type] ?? f.type,
      codeVersion: ev.code_version,
      confidence: percent(f.confidence),
      formula: f.method,
      result: ev.result != null ? money(Math.round(ev.result * 100)) : undefined,
      reviewedBy: f.decided_by_name
        ? `${f.decided_by_name}${f.decided_at ? `, ${date(f.decided_at)}` : ""}`
        : undefined,
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

  const card = (f: ModelFinding) => {
    const saving = toTiyn(f.saving_estimate);
    const action = labels.actions[f.type];
    return (
      <li
        key={f.id}
        data-reveal
        data-testid="report-finding"
        className="rounded-[var(--qs-card-radius)] border border-line bg-surface p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{labels.types[f.type] ?? f.type}</p>
            <p className="mt-1 text-base text-ink">
              {f.item_name}
              {f.enstru_code && (
                <span className="ml-2 font-mono text-xs text-muted">
                  {f.enstru_code}
                  {f.enstru_code.startsWith("SYN-") ? ` · ${labels.sample}` : ""}
                </span>
              )}
            </p>
            {f.supplier_name && <p className="text-sm text-muted">{f.supplier_name}</p>}
            <Badge variant="neutral" className="mt-2">
              {fill(labels.confidence, { value: percent(f.confidence) })}
            </Badge>
          </div>
          <button
            type="button"
            onClick={() => void showFinding(f)}
            disabled={!f.evidence_id}
            aria-label={`${labels.openEvidence}: ${money(saving)}`}
            data-testid="finding-saving"
            className="rounded-[var(--qs-radius-md)] border-b-2 border-dotted border-[var(--qs-accent-strong)] px-1 text-lg font-semibold text-ink tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)]"
          >
            {money(saving)}
          </button>
        </div>
        {action && (
          <p className="mt-3 text-sm text-ink">
            <span className="font-medium">{labels.action}: </span>
            {fill(action, { item: f.item_name ?? "", supplier: f.supplier_name ?? "" })}
          </p>
        )}
        {f.decision === "edit" && f.decision_note && (
          <p className="mt-2 text-sm text-muted">
            <span className="font-medium">{labels.note}: </span>
            {f.decision_note}
          </p>
        )}
      </li>
    );
  };

  if (model.ranked.length === 0)
    return <EmptyState title={labels.none} message={labels.noneHint} />;

  let running = 0;
  const pareto = model.byType.map((t) => {
    running += t.tiyn;
    return {
      label: labels.types[t.type] ?? t.type,
      spend: Math.round(t.tiyn / 100),
      cumulative: Math.round((running / model.totalTiyn) * 100),
    };
  });

  return (
    <div ref={root} className="space-y-6">
      <header data-reveal className="space-y-1">
        <p className="text-sm text-muted">
          {fill(labels.period, { start: date(report.period_start), end: date(report.period_end) })}
        </p>
        <p className="text-sm text-muted" data-testid="reviewed-by">
          {report.status === "released" && report.released_at
            ? reviewer
              ? fill(labels.reviewedBy, { name: reviewer, date: date(report.released_at) })
              : fill(labels.reviewedByUnknown, { date: date(report.released_at) })
            : labels.notReleased}
        </p>
      </header>

      <section
        data-reveal
        className="rounded-[var(--qs-card-radius)] border border-line bg-surface p-5"
      >
        <button
          type="button"
          onClick={() => showParts(labels.headline, model.ranked)}
          aria-label={`${labels.openEvidence}: ${labels.headline} ${money(model.totalTiyn)}`}
          data-testid="report-headline"
          className="block w-full rounded-[var(--qs-radius-md)] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)]"
        >
          <Kpi
            label={labels.headline}
            value={model.totalTiyn / 100}
            format={(v) => money(Math.round(v * 100))}
            durationMs={400}
          />
        </button>
        <p className="mt-2 text-sm text-muted">
          {fill(labels.headlineHint, { count: model.ranked.length })}
        </p>
        <a
          href={pdfHref}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[var(--qs-accent-strong)] underline"
          data-testid="download-pdf"
        >
          {labels.downloadPdf}
        </a>
      </section>

      <section data-reveal aria-labelledby="top-findings" className="space-y-3">
        <h2 id="top-findings" className="text-lg font-semibold text-ink">
          {labels.top}
        </h2>
        <ol className="space-y-3" data-testid="findings">
          {model.top.map(card)}
        </ol>
        {model.rest.length > 0 && (
          <details className="rounded-[var(--qs-card-radius)] border border-line bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              {fill(labels.all, { count: model.rest.length })}
            </summary>
            <ol className="mt-3 space-y-3">{model.rest.map(card)}</ol>
          </details>
        )}
      </section>

      <section data-reveal aria-labelledby="by-type">
        <h2 id="by-type" className="sr-only">
          {labels.byType}
        </h2>
        <ConcentrationPareto
          data={pareto}
          title={labels.byType}
          description={labels.byTypeDescription}
          seriesNames={{ bar: labels.colSaving, line: labels.colShare }}
          table={{
            label: labels.byTypeTable,
            headers: [labels.colType, labels.colCount, labels.colSaving, labels.colShare],
            rows: model.byType.map((t, i) => [
              labels.types[t.type] ?? t.type,
              t.count,
              money(t.tiyn),
              `${pareto[i]?.cumulative ?? 0}%`,
            ]),
          }}
        />
      </section>

      <section data-reveal aria-labelledby="next-steps" className="space-y-2">
        <h2 id="next-steps" className="text-lg font-semibold text-ink">
          {labels.todo}
        </h2>
        <ul className="space-y-2" data-testid="next-steps">
          {model.byType.map((t) => (
            <li key={t.type} className="rounded-md border border-line bg-surface p-3 text-sm">
              <span className="font-medium text-ink">{labels.todoLabels[t.type] ?? t.type}</span>
              {" · "}
              <button
                type="button"
                onClick={() =>
                  showParts(
                    labels.todoLabels[t.type] ?? t.type,
                    model.ranked.filter((f) => f.type === t.type),
                  )
                }
                aria-label={`${labels.openEvidence}: ${money(t.tiyn)}`}
                className="text-muted underline decoration-dotted tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)]"
              >
                {fill(labels.todoLine, { count: t.count, amount: money(t.tiyn) })}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <EvidenceDrawer
        open={open}
        onOpenChange={setOpen}
        evidence={evidence}
        labels={{ ...labels.drawer, reviewed: labels.reviewed, parts: labels.parts }}
      />
    </div>
  );
}
