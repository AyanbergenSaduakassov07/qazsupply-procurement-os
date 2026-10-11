"use client";

import { animate, durations, stagger, useAnimeScope, useReducedMotion } from "@qazsupply/motion";
import { Badge } from "@qazsupply/ui/components/badge";
import { Button } from "@qazsupply/ui/components/button";
import { Card, CardBody, CardHeader, CardTitle } from "@qazsupply/ui/components/card";
import { ErrorState, LoadingState } from "@qazsupply/ui/components/states";
import { useId, useState } from "react";

import { type Imported, importUpload, type Preview, previewUpload } from "../../app/spend-actions";

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
const REQUIRED = new Set(["item_text", "unit_price", "purchased_on"]);
const MAX_BYTES = 25 * 1024 * 1024;

export interface UploadLabels {
  title: string;
  drop: string;
  choose: string;
  reading: string;
  mapping: string;
  mappingHint: string;
  none: string;
  required: string;
  sample: string;
  rowsTotal: string;
  checks: string;
  confirm: string;
  importing: string;
  done: string;
  inserted: string;
  rejected: string;
  duplicate: string;
  matched: string;
  toReview: string;
  goReview: string;
  another: string;
  skippedRows: string;
  retry: string;
  errorTitle: string;
  fields: Record<string, string>;
  fileErrors: Record<string, string>;
  rowErrors: Record<string, string>;
  rowErrorsShort: Record<string, string>;
}

type State =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "mapping"; file: File; preview: Preview; mapping: Record<string, number> }
  | { step: "importing"; file: File }
  | { step: "done"; result: Imported }
  | { step: "error"; code: string };

function rowMessage(labels: UploadLabels, code: string, row: number): string {
  return (labels.rowErrors[code] ?? code).replace("{row}", String(row));
}

function SampleTable({ preview }: { preview: Preview }) {
  const reduced = useReducedMotion();
  const ref = useAnimeScope<HTMLTableSectionElement>(
    (self) => {
      if (!self?.root) return;
      const rows = Array.from((self.root as HTMLElement).querySelectorAll("tr"));
      rows.forEach((row, i) => {
        animate(row, {
          opacity: [0, 1],
          translateY: reduced ? [0, 0] : [4, 0],
          duration: reduced ? 0 : durations.micro,
          delay: reduced ? 0 : stagger(i),
          ease: "outQuad",
        });
      });
    },
    [reduced, preview.sample.length],
  );
  return (
    <section
      tabIndex={0}
      aria-label={preview.sheet}
      className="max-h-80 overflow-auto rounded-[var(--qs-radius-md)] border border-line focus-visible:outline-2 focus-visible:outline-[var(--qs-focus)]"
    >
      <table className="w-full min-w-[40rem] text-left text-xs">
        <thead className="sticky top-0 bg-surface-raised text-muted">
          <tr>
            {preview.columns.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: export headers may repeat; position is the identity
              <th key={`${c}-${i}`} scope="col" className="px-3 py-2 font-medium">
                {c || `#${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={ref}>
          {preview.sample.map((row, r) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: preview rows have no identity
            <tr key={r} className="border-line border-t">
              {row.map((cell, c) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: positional cells
                <td key={c} className="px-3 py-1.5 text-ink tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function UploadWizard({ labels, reviewHref }: { labels: UploadLabels; reviewHref: string }) {
  const [state, setState] = useState<State>({ step: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputId = useId();

  const start = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) return setState({ step: "error", code: "too_large" });
    setState({ step: "reading" });
    const form = new FormData();
    form.set("file", file);
    const preview = await previewUpload(form);
    if (!preview.ok) return setState({ step: "error", code: preview.code });
    setState({ step: "mapping", file, preview, mapping: { ...preview.mapping } });
  };

  const confirm = async (file: File, mapping: Record<string, number>, sheet: string) => {
    setState({ step: "importing", file });
    const form = new FormData();
    form.set("file", file);
    form.set("mapping", JSON.stringify(mapping));
    form.set("sheet", sheet);
    const result = await importUpload(form);
    setState(result.ok ? { step: "done", result } : { step: "error", code: result.code });
  };

  if (state.step === "reading" || state.step === "importing") {
    return <LoadingState label={state.step === "reading" ? labels.reading : labels.importing} />;
  }

  if (state.step === "error") {
    return (
      <ErrorState
        title={labels.errorTitle}
        message={labels.fileErrors[state.code] ?? labels.fileErrors.unexpected ?? state.code}
        action={<Button onClick={() => setState({ step: "idle" })}>{labels.retry}</Button>}
      />
    );
  }

  if (state.step === "done") {
    const r = state.result;
    return (
      <Card>
        <CardHeader>
          <CardTitle>{labels.done}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {r.duplicate && (
            <p role="status" className="text-sm text-ink">
              {labels.duplicate}
            </p>
          )}
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" data-testid="import-result">
            {[
              [labels.inserted, r.inserted],
              [labels.rejected, r.rejected],
              [labels.matched, r.auto],
              [labels.toReview, r.review + r.bundled],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-[var(--qs-radius-md)] border border-line p-3"
              >
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-1 text-lg font-semibold text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {r.errors.length > 0 && (
            <section aria-label={labels.skippedRows}>
              <h3 className="mb-2 text-sm font-medium text-ink">{labels.skippedRows}</h3>
              <ul
                className="max-h-60 space-y-1 overflow-auto text-sm text-ink"
                data-testid="row-errors"
              >
                {r.errors.map((e) => (
                  <li key={`${e.row}-${e.code}`}>{rowMessage(labels, e.code, e.row)}</li>
                ))}
              </ul>
            </section>
          )}
          <div className="flex flex-wrap gap-2">
            {r.review + r.bundled > 0 && (
              <a
                href={reviewHref}
                className="inline-flex min-h-11 items-center rounded-[var(--qs-radius-md)] bg-[var(--qs-accent-strong)] px-4 text-sm font-medium text-[var(--qs-on-accent)]"
              >
                {labels.goReview}
              </a>
            )}
            <Button variant="secondary" onClick={() => setState({ step: "idle" })}>
              {labels.another}
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (state.step === "mapping") {
    const { file, preview, mapping } = state;
    const hasPrice = "unit_price" in mapping || ("total" in mapping && "quantity" in mapping);
    const missing = [...REQUIRED].filter(
      (f) => !(f in mapping) && !(f === "unit_price" && hasPrice),
    );
    const setField = (field: string, value: string) => {
      const next = { ...mapping };
      if (value === "") delete next[field];
      else next[field] = Number(value);
      setState({ ...state, mapping: next });
    };
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{labels.mapping}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-muted">{labels.mappingHint}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((field) => (
                <label key={field} className="block text-sm text-ink">
                  <span>
                    {labels.fields[field]}
                    {REQUIRED.has(field) && (
                      <span className="ml-1 text-xs text-muted">({labels.required})</span>
                    )}
                  </span>
                  <select
                    name={field}
                    value={field in mapping ? String(mapping[field]) : ""}
                    onChange={(e) => setField(field, e.target.value)}
                    className="mt-1 block min-h-11 w-full rounded-[var(--qs-radius-md)] border border-line bg-surface px-3 text-sm text-ink"
                  >
                    <option value="">{labels.none}</option>
                    {preview.columns.map((c, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: export headers may repeat; position is the identity
                      <option key={`${c}-${i}`} value={i}>
                        {c || `#${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="text-sm text-ink">
              {labels.rowsTotal}: <span className="tabular-nums">{preview.rows_total}</span>
            </p>
            {Object.keys(preview.errors_by_code).length > 0 && (
              <div className="text-sm">
                <p className="text-ink">{labels.checks}</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {Object.entries(preview.errors_by_code).map(([code, n]) => (
                    <li key={code}>
                      <Badge variant="risk">
                        {labels.rowErrorsShort[code] ?? code} × {n}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => confirm(file, mapping, preview.sheet)}
                disabled={missing.length > 0}
                aria-describedby={missing.length ? `${inputId}-missing` : undefined}
              >
                {labels.confirm}
              </Button>
              {missing.length > 0 && (
                <p id={`${inputId}-missing`} className="text-sm text-risk">
                  {missing.map((f) => labels.fields[f]).join(", ")}
                </p>
              )}
              <Button variant="ghost" onClick={() => setState({ step: "idle" })}>
                {labels.another}
              </Button>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{labels.sample}</CardTitle>
          </CardHeader>
          <CardBody>
            <SampleTable preview={preview} />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <label
      htmlFor={inputId}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void start(e.dataTransfer.files[0]);
      }}
      className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--qs-card-radius)] border-2 border-dashed px-6 py-10 text-center transition-colors motion-reduce:transition-none ${
        dragging ? "border-[var(--qs-focus)] bg-surface-raised" : "border-line bg-surface"
      }`}
    >
      <span className="text-base text-ink">{labels.drop}</span>
      <span className="inline-flex min-h-11 items-center rounded-[var(--qs-radius-md)] border border-line px-4 text-sm text-ink">
        {labels.choose}
      </span>
      <input
        id={inputId}
        type="file"
        accept=".xlsx,.csv,text/csv"
        className="sr-only"
        data-testid="upload-input"
        onChange={(e) => void start(e.target.files?.[0])}
      />
    </label>
  );
}
