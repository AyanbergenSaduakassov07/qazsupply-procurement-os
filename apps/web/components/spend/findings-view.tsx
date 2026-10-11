"use client";

import { Button } from "@qazsupply/ui/components/button";
import type { EvidenceDrawerProps } from "@qazsupply/ui/components/evidence-drawer";
import { ErrorState } from "@qazsupply/ui/components/states";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { runAnalysis } from "../../app/spend-actions";

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
