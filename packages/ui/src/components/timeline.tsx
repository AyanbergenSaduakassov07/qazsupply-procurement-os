import { cn } from "../lib/utils";
import { Badge } from "./badge";

export interface TimelineItem {
  id: string;
  title: string;
  occurredAt: string;
  recordedAt?: string;
  source: string;
  confidence: "high" | "medium" | "low";
  /** Conflicting event shown greyed, superseded by the documented rule. */
  conflicting?: boolean;
  note?: string;
}

const confidenceVariant = { high: "ok", medium: "gold", low: "neutral" } as const;

/**
 * Vertical timeline. Provenance (source + confidence) is always shown; conflicting
 * events are de-emphasised rather than hidden, with the rule that overrode them.
 */
export function Timeline({
  items,
  labels,
  className,
}: {
  items: TimelineItem[];
  labels: {
    confidence: Record<TimelineItem["confidence"], string>;
    recorded: string;
    conflict: string;
  };
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col gap-0", className)}>
      {items.map((item) => (
        <li key={item.id} className="relative flex gap-3 pb-4">
          <span
            aria-hidden="true"
            className={cn(
              "mt-1.5 size-2.5 shrink-0 rounded-full",
              item.conflicting ? "bg-line" : "bg-[var(--qs-accent)]",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span
                className={cn(
                  "text-sm font-medium",
                  item.conflicting ? "text-muted line-through" : "text-ink",
                )}
              >
                {item.title}
              </span>
              <time className="text-xs text-muted tabular-nums">{item.occurredAt}</time>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{item.source}</Badge>
              <Badge variant={confidenceVariant[item.confidence]}>
                {labels.confidence[item.confidence]}
              </Badge>
              {item.recordedAt ? (
                <span className="text-xs text-muted">
                  {labels.recorded} {item.recordedAt}
                </span>
              ) : null}
            </div>
            {item.conflicting ? <p className="mt-1 text-xs text-muted">{labels.conflict}</p> : null}
            {item.note ? <p className="mt-1 text-xs text-muted">{item.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
