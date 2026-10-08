import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Badge } from "./badge";
import { Card } from "./card";

export interface FindingCardProps {
  type: string;
  title: string;
  /** Preformatted money impact; every figure opens Evidence. */
  saving: string;
  savingLabel: string;
  confidenceLabel: string;
  evidenceLabel: string;
  onOpenEvidence?: () => void;
  severity?: "risk" | "gold" | "ok" | "neutral";
  children?: ReactNode;
  className?: string;
}

export function FindingCard({
  type,
  title,
  saving,
  savingLabel,
  confidenceLabel,
  evidenceLabel,
  onOpenEvidence,
  severity = "gold",
  children,
  className,
}: FindingCardProps) {
  return (
    <Card className={cn("flex flex-col gap-3 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant={severity}>{type}</Badge>
          <h3 className="mt-2 text-sm font-semibold text-ink">{title}</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">{savingLabel}</p>
          <p className="text-lg font-semibold text-ink tabular-nums">{saving}</p>
        </div>
      </div>

      {children}

      <div className="flex items-center justify-between gap-2 border-line border-t pt-3">
        <span className="text-xs text-muted">{confidenceLabel}</span>
        <button
          type="button"
          onClick={onOpenEvidence}
          disabled={!onOpenEvidence}
          className="rounded-[var(--qs-radius-sm)] px-2 py-1 text-xs font-medium text-link hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)] disabled:text-muted disabled:no-underline"
        >
          {evidenceLabel}
        </button>
      </div>
    </Card>
  );
}
