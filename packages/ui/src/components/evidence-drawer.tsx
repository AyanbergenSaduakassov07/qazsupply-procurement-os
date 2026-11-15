"use client";

import { Drawer } from "vaul";

import { Badge } from "./badge";

export interface EvidenceSourceRow {
  id: string;
  fileName: string;
  sourceRow: number;
  itemText?: string;
  supplierText?: string;
  quantity?: string;
  unitPrice?: string;
  currency?: string;
  purchasedOn?: string;
}

export interface EvidenceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evidence: {
    id: string;
    computationId: string;
    method: string;
    codeVersion: string;
    confidence: string;
    /** The computation in words, before the raw rows. */
    formula: string;
    result?: string;
    /** Named human who decided on this figure ("who reviewed"). */
    reviewedBy?: string;
    /** For an aggregate figure: the figures it adds up, each with its own Evidence id. */
    parts?: { label: string; value: string; evidenceId: string }[];
    sources: EvidenceSourceRow[];
  } | null;
  labels: {
    title: string;
    method: string;
    confidence: string;
    version: string;
    computation: string;
    sources: string;
    empty: string;
    close: string;
    file: string;
    row: string;
    item: string;
    supplier: string;
    qty: string;
    price: string;
    date: string;
    reviewed?: string;
    parts?: string;
  };
}

/**
 * Side drawer: the figure stays visible behind a light scrim. Order is
 * title -> meta (method, confidence, version) -> how computed -> source rows.
 * No figure reaches a client without one (docs/glossary.md, Evidence).
 */
export function EvidenceDrawer({ open, onOpenChange, evidence, labels }: EvidenceDrawerProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[var(--qs-scrim-bg)]" />
        <Drawer.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-line border-l bg-surface shadow-[var(--qs-elevation-3)]">
          <div
            data-vaul-no-drag
            className="flex items-start justify-between gap-3 border-line border-b px-5 py-4"
          >
            <div>
              <Drawer.Title className="text-base font-semibold text-ink">
                {labels.title}
              </Drawer.Title>
              {evidence ? (
                <Drawer.Description className="mt-1 font-mono text-xs text-muted">
                  {evidence.id}
                </Drawer.Description>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={labels.close}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--qs-radius-md)] text-muted hover:bg-surface-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!evidence ? (
              <p className="text-sm text-muted">{labels.empty}</p>
            ) : (
              <div className="flex flex-col gap-5">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted">{labels.method}</dt>
                  <dd className="text-ink">{evidence.method}</dd>
                  <dt className="text-muted">{labels.confidence}</dt>
                  <dd>
                    <Badge variant="neutral">{evidence.confidence}</Badge>
                  </dd>
                  <dt className="text-muted">{labels.version}</dt>
                  <dd className="font-mono text-xs text-ink">{evidence.codeVersion}</dd>
                  {evidence.reviewedBy ? (
                    <>
                      <dt className="text-muted">{labels.reviewed}</dt>
                      <dd className="text-ink" data-testid="evidence-reviewed-by">
                        {evidence.reviewedBy}
                      </dd>
                    </>
                  ) : null}
                </dl>

                <section>
                  <h3 className="mb-1 text-xs font-medium text-muted">{labels.computation}</h3>
                  <p className="text-sm text-ink">{evidence.formula}</p>
                  {evidence.result ? (
                    <p className="mt-1 text-sm text-ink tabular-nums">{evidence.result}</p>
                  ) : null}
                </section>

                {evidence.parts?.length ? (
                  <section>
                    <h3 className="mb-2 text-xs font-medium text-muted">{labels.parts}</h3>
                    <ul className="flex flex-col gap-1 text-sm" data-testid="evidence-parts">
                      {evidence.parts.map((p) => (
                        <li key={p.evidenceId} className="flex justify-between gap-3">
                          <span className="text-ink">{p.label}</span>
                          <span className="text-ink tabular-nums">{p.value}</span>
                          <span className="sr-only">{p.evidenceId}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {evidence.sources.length || !evidence.parts?.length ? (
                  <section>
                    <h3 className="mb-2 text-xs font-medium text-muted">{labels.sources}</h3>
                    <section
                      tabIndex={0}
                      aria-label={labels.sources}
                      className="overflow-x-auto rounded-[var(--qs-radius-md)] border border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)]"
                    >
                      <table className="w-full text-left text-xs">
                        <caption className="sr-only">{labels.sources}</caption>
                        <thead className="bg-surface-raised text-muted">
                          <tr>
                            <th className="px-3 py-2 font-medium">{labels.file}</th>
                            <th className="px-3 py-2 font-medium">{labels.row}</th>
                            <th className="px-3 py-2 font-medium">{labels.item}</th>
                            <th className="px-3 py-2 font-medium">{labels.supplier}</th>
                            <th className="px-3 py-2 font-medium">{labels.qty}</th>
                            <th className="px-3 py-2 font-medium">{labels.price}</th>
                            <th className="px-3 py-2 font-medium">{labels.date}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evidence.sources.map((source) => (
                            <tr key={source.id} className="border-line border-t">
                              <td className="px-3 py-2 text-ink">{source.fileName}</td>
                              <td className="px-3 py-2 tabular-nums text-ink">
                                {source.sourceRow}
                              </td>
                              <td className="px-3 py-2 text-ink">{source.itemText ?? "—"}</td>
                              <td className="px-3 py-2 text-ink">{source.supplierText ?? "—"}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-ink">
                                {source.quantity ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-ink">
                                {source.unitPrice
                                  ? `${source.unitPrice} ${source.currency ?? ""}`
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 tabular-nums text-ink">
                                {source.purchasedOn ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
