"use client";

import { countUp, useReducedMotion } from "@qazsupply/motion";
import { useEffect, useRef, useState } from "react";

import { cn } from "../lib/utils";

const defaultFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export interface KpiProps {
  label: string;
  value: number;
  hint?: string;
  format?: (value: number) => string;
  durationMs?: number;
  className?: string;
}

/**
 * A single figure with a count-up. Tabular figures come from the font; under
 * reduced motion the value appears instantly (no animation).
 */
export function Kpi({
  label,
  value,
  hint,
  format = defaultFormat.format,
  durationMs = 800,
  className,
}: KpiProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const frame = useRef(0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return undefined;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      setDisplay(countUp(0, value, progress));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, reduced, durationMs]);

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-xs text-muted">{label}</span>
      <span className="text-2xl font-semibold text-ink tabular-nums">{format(display)}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}
