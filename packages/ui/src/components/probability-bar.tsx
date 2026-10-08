import { cn } from "../lib/utils";

export interface ProbabilityBarProps {
  /** Window the bar spans, in the same unit as the quantiles (e.g. day offsets). */
  min: number;
  max: number;
  p10: number;
  p50: number;
  p90: number;
  /** Planned/promised date as a fractional position in [min, max]. */
  promiseAt?: number;
  /** P(arrive by the promised date), 0..1. Shown as a percentage. */
  probabilityByPromise?: number;
  labels: { p10: string; p50: string; p90: string; promise: string; probability: string };
  className?: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(1, Math.max(0, (value - min) / (max - min)));

/**
 * ETA as an 80% band (p10..p90) with a median marker and P(by promise).
 * Never renders a single arrival date.
 */
export function ProbabilityBar({
  min,
  max,
  p10,
  p50,
  p90,
  promiseAt,
  probabilityByPromise,
  labels,
  className,
}: ProbabilityBarProps) {
  const left = clamp(p10, min, max);
  const right = clamp(p90, min, max);
  const median = clamp(p50, min, max);
  const promise = promiseAt === undefined ? undefined : clamp(promiseAt, min, max);
  const invalid = p10 > p50 || p50 > p90;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative h-3 rounded-full bg-surface-raised">
        <div
          className="absolute inset-y-0 rounded-full bg-[var(--qs-accent)]/40"
          style={{ left: `${left * 100}%`, width: `${Math.max(right - left, 0.02) * 100}%` }}
        />
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-[var(--qs-accent-strong)]"
          style={{ left: `${median * 100}%` }}
        />
        {promise !== undefined ? (
          <div
            className="absolute inset-y-[-4px] w-0.5 -translate-x-1/2 bg-gold"
            style={{ left: `${promise * 100}%` }}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          {labels.p10}: <span className="tabular-nums text-ink">{p10}</span>
        </span>
        <span>
          {labels.p50}: <span className="tabular-nums text-ink">{p50}</span>
        </span>
        <span>
          {labels.p90}: <span className="tabular-nums text-ink">{p90}</span>
        </span>
        {promiseAt !== undefined ? (
          <span>
            {labels.promise}: <span className="tabular-nums text-ink">{promiseAt}</span>
          </span>
        ) : null}
        {probabilityByPromise !== undefined ? (
          <span>
            {labels.probability}:{" "}
            <span className="tabular-nums text-ink">{Math.round(probabilityByPromise * 100)}%</span>
          </span>
        ) : null}
      </div>

      {invalid ? (
        <p role="alert" className="text-xs text-risk">
          ETA quantiles are not ordered (p10 ≤ p50 ≤ p90 expected).
        </p>
      ) : null}
    </div>
  );
}
