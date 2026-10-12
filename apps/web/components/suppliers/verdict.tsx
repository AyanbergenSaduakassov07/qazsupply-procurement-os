import { Badge } from "@qazsupply/ui/components/badge";

export type Verdict = "ok" | "caution" | "high_risk" | "unknown";

const VARIANT = { ok: "ok", caution: "gold", high_risk: "risk", unknown: "neutral" } as const;
const PATH: Record<Verdict | "none", string> = {
  ok: "M5 12l5 5L20 7",
  caution: "M12 4l9 16H3zM12 10v4M12 17h.01",
  high_risk: "M8 3h8l5 5v8l-5 5H8l-5-5V8zM9 9l6 6M15 9l-6 6",
  unknown:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h.01",
  none: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
};

/** Verdict as icon + words, never colour alone (WCAG 1.4.1). */
export function VerdictBadge({
  verdict,
  labels,
}: {
  verdict: Verdict | null | undefined;
  labels: Record<string, string>;
}) {
  const key = verdict ?? "none";
  return (
    <Badge variant={verdict ? VARIANT[verdict] : "neutral"} data-testid="verdict">
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={PATH[key]} />
      </svg>
      {labels[key]}
    </Badge>
  );
}
