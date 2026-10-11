"use client";

import { Badge } from "@qazsupply/ui/components/badge";
import { Button } from "@qazsupply/ui/components/button";
import { Card, CardBody } from "@qazsupply/ui/components/card";
import { EvidenceDrawer, type EvidenceDrawerProps } from "@qazsupply/ui/components/evidence-drawer";
import { EmptyState, ErrorState } from "@qazsupply/ui/components/states";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { loadEvidence, runAnalysis } from "../../app/spend-actions";

export interface FindingRow {
  id: string;
  type: string;
  saving_estimate: string;
  method: string;
  confidence: string;
  item_name: string | null;
  enstru_code: string | null;
  supplier_name: string | null;
  evidence_id: string | null;
  details: Record<string, unknown>;
}

export interface FindingsLabels {
  total: string;
  saving: string;
  confidence: string;
  method: string;
  openEvidence: string;
  item: string;
  supplier: string;
  type: string;
  types: Record<string, string>;
  assumption: string;
  noSaving: string;
  none: string;
  noneHint: string;
  error: string;
  drawer: EvidenceDrawerProps["labels"];
}

function formatter(locale: string) {
  const tag = locale === "kk" ? "kk-KZ" : locale === "ru" ? "ru-RU" : "en-GB";
  return new Intl.NumberFormat(tag, {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  });
}

export function FindingsView({
  findings,
  labels,
  locale,
}: {
  findings: FindingRow[];
  labels: FindingsLabels;
  locale: string;
}) {
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceDrawerProps["evidence"]>(null);
  const fmt = formatter(locale);
  const total = findings.reduce((sum, f) => sum + Number(f.saving_estimate), 0);

  const show = async (f: FindingRow) => {
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
      confidence: `${Math.round(Number(f.confidence) * 100)}%`,
      formula: f.method,
      result: ev.result != null ? fmt.format(ev.result) : undefined,
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

  if (findings.length === 0) return <EmptyState title={labels.none} message={labels.noneHint} />;

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <p className="text-sm text-muted">{labels.total}</p>
          <p
            className="mt-1 text-2xl font-semibold text-ink tabular-nums"
            data-testid="findings-total"
          >
            {fmt.format(total)}
          </p>
        </CardBody>
      </Card>
      <ul className="space-y-3" data-testid="findings">
        {findings.map((f) => {
          const saving = Number(f.saving_estimate);
          const assumption = f.method.startsWith("ASSUMPTION");
          return (
            <li
              key={f.id}
              className="rounded-[var(--qs-card-radius)] border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{labels.types[f.type] ?? f.type}</p>
                  <p className="mt-1 text-sm text-ink">
                    {f.item_name}
                    {f.enstru_code ? (
                      <span className="ml-2 font-mono text-xs text-muted">{f.enstru_code}</span>
                    ) : null}
                  </p>
                  {f.supplier_name && (
                    <p className="text-xs text-muted">
                      {labels.supplier}: {f.supplier_name}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="neutral">
                      {labels.confidence} {Math.round(Number(f.confidence) * 100)}%
                    </Badge>
                    {assumption && <Badge variant="gold">{labels.assumption}</Badge>}
                    {saving === 0 && <Badge variant="neutral">{labels.noSaving}</Badge>}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void show(f)}
                  disabled={!f.evidence_id}
                  aria-label={`${labels.openEvidence}: ${fmt.format(saving)}`}
                  className="tabular-nums"
                >
                  {fmt.format(saving)}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <EvidenceDrawer
        open={open}
        onOpenChange={setOpen}
        evidence={evidence}
        labels={labels.drawer}
      />
    </div>
  );
}

export function RunAnalysisButton({
  label,
  runningLabel,
  locale,
  errors,
}: {
  label: string;
  runningLabel: string;
  locale: string;
  errors: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    const r = await runAnalysis();
    setBusy(false);
    if (!r.ok) return setError(errors[r.code] ?? errors.unexpected ?? r.code);
    router.push(r.reportId ? `/${locale}/spend/reports/${r.reportId}` : `/${locale}/spend/reports`);
    router.refresh();
  };
  return (
    <div className="space-y-2">
      <Button onClick={() => void run()} disabled={busy}>
        {busy ? runningLabel : label}
      </Button>
      {error && <ErrorState title={error} message="" />}
    </div>
  );
}
