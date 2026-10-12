"use client";

import { Button } from "@qazsupply/ui/components/button";
import { useState } from "react";

import { saveRiskWeights } from "../../app/supplier-actions";

/** Per-org risk factor weights (admins). 0 switches a factor off; the server clamps to 0..100. */
export function RiskWeights({
  defaults,
  weights,
  canEdit,
  labels,
}: {
  defaults: Record<string, number>;
  weights: Record<string, number>;
  canEdit: boolean;
  labels: {
    factor: Record<string, string>;
    hint: string;
    save: string;
    saved: string;
    defaultN: string;
    error: string;
  };
}) {
  const [values, setValues] = useState(weights);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const r = await saveRiskWeights(values);
    setBusy(false);
    setStatus(r.ok ? labels.saved : labels.error);
  };
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="text-sm text-muted">{labels.hint}</p>
      {Object.keys(defaults).map((code) => (
        <div key={code} className="flex flex-wrap items-center gap-3">
          <label htmlFor={`w-${code}`} className="min-w-0 flex-1 text-sm text-ink">
            {labels.factor[code] ?? code}
          </label>
          <input
            id={`w-${code}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            disabled={!canEdit}
            value={values[code] ?? 0}
            onChange={(e) => setValues((v) => ({ ...v, [code]: Number(e.target.value) }))}
            aria-describedby={`w-${code}-d`}
            className="min-h-11 w-20 rounded border border-line bg-surface px-2 text-right text-ink tabular-nums"
          />
          <span id={`w-${code}-d`} className="w-28 text-xs text-muted">
            {labels.defaultN.replace("{n}", String(defaults[code]))}
          </span>
        </div>
      ))}
      {canEdit && (
        <Button type="submit" size="sm" disabled={busy}>
          {labels.save}
        </Button>
      )}
      <p role="status" aria-live="polite" className="text-sm text-muted">
        {status}
      </p>
    </form>
  );
}
