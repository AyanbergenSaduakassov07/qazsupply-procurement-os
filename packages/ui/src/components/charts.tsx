"use client";

import type { ReactNode } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "../lib/utils";

export interface ChartTable {
  label: string;
  headers: string[];
  rows: (string | number)[][];
}

/** Figure wrapper: title, an aria-labelled image role, and a table alternative. */
function ChartFrame({
  title,
  description,
  table,
  height,
  className,
  children,
}: {
  title: string;
  description?: string;
  table: ChartTable;
  height: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <figcaption className="text-sm font-medium text-ink">{title}</figcaption>
      {description ? <p className="text-xs text-muted">{description}</p> : null}
      <div role="img" aria-label={title} style={{ height }}>
        {children}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-link">{table.label}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-raised text-muted">
              <tr>
                {table.headers.map((header) => (
                  <th key={header} scope="col" className="px-2 py-1 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={String(row[0])} className="border-line border-t">
                  {row.map((cell, index) => (
                    <td
                      key={table.headers[index] ?? `col-${index}`}
                      className="px-2 py-1 tabular-nums text-ink"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export interface PriceVarianceDatum {
  label: string;
  low: number;
  high: number;
  point: number;
}

/** Price variance: a dot inside a range (low..high) per item. */
export function PriceVariancePlot({
  data,
  title,
  description,
  table,
  height = 260,
}: {
  data: PriceVarianceDatum[];
  title: string;
  description?: string;
  table: ChartTable;
  height?: number;
}) {
  const series = data.map((d) => ({ ...d, base: d.low, span: Math.max(d.high - d.low, 0) }));
  return (
    <ChartFrame title={title} description={description} table={table} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={series}
          layout="vertical"
          margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--qs-border)" />
          <XAxis type="number" stroke="var(--qs-text-muted)" fontSize={12} />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            stroke="var(--qs-text-muted)"
            fontSize={12}
          />
          <Tooltip
            contentStyle={{
              background: "var(--qs-surface)",
              border: "1px solid var(--qs-border)",
              color: "var(--qs-text)",
            }}
          />
          <Bar dataKey="base" stackId="range" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="span" stackId="range" fill="var(--qs-accent)" isAnimationActive={false} />
          <Scatter dataKey="point" fill="var(--qs-accent-strong)" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export interface ConcentrationDatum {
  label: string;
  spend: number;
  cumulative: number;
}

/** Concentration: Pareto — spend bars with a cumulative line (0-100). */
export function ConcentrationPareto({
  data,
  title,
  description,
  table,
  height = 260,
}: {
  data: ConcentrationDatum[];
  title: string;
  description?: string;
  table: ChartTable;
  height?: number;
}) {
  return (
    <ChartFrame title={title} description={description} table={table} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--qs-border)" />
          <XAxis dataKey="label" stroke="var(--qs-text-muted)" fontSize={12} />
          <YAxis yAxisId="spend" stroke="var(--qs-text-muted)" fontSize={12} />
          <YAxis
            yAxisId="cumulative"
            orientation="right"
            domain={[0, 100]}
            stroke="var(--qs-text-muted)"
            fontSize={12}
          />
          <Tooltip
            contentStyle={{
              background: "var(--qs-surface)",
              border: "1px solid var(--qs-border)",
              color: "var(--qs-text)",
            }}
          />
          <Legend />
          <Bar
            yAxisId="spend"
            dataKey="spend"
            name="spend"
            fill="var(--qs-accent)"
            isAnimationActive={false}
          />
          <Line
            yAxisId="cumulative"
            type="monotone"
            dataKey="cumulative"
            name="cumulative %"
            stroke="var(--qs-gold-text)"
            strokeDasharray="4 2"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export interface EtaBandDatum {
  day: string;
  p10: number;
  p50: number;
  p90: number;
}

/** ETA: an 80% band (p10..p90), the median, and the promise line. */
export function EtaBandChart({
  data,
  promiseDay,
  promiseLabel,
  title,
  description,
  table,
  height = 260,
}: {
  data: EtaBandDatum[];
  promiseDay?: string;
  promiseLabel?: string;
  title: string;
  description?: string;
  table: ChartTable;
  height?: number;
}) {
  return (
    <ChartFrame title={title} description={description} table={table} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--qs-border)" />
          <XAxis dataKey="day" stroke="var(--qs-text-muted)" fontSize={12} />
          <YAxis stroke="var(--qs-text-muted)" fontSize={12} />
          <Tooltip
            contentStyle={{
              background: "var(--qs-surface)",
              border: "1px solid var(--qs-border)",
              color: "var(--qs-text)",
            }}
          />
          <Area
            dataKey="p90"
            stroke="none"
            fill="var(--qs-accent)"
            fillOpacity={0.25}
            isAnimationActive={false}
          />
          <Area
            dataKey="p10"
            stroke="none"
            fill="var(--qs-surface)"
            fillOpacity={1}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p50"
            stroke="var(--qs-accent-strong)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {promiseDay ? (
            <ReferenceLine
              x={promiseDay}
              stroke="var(--qs-gold-text)"
              strokeDasharray="4 2"
              label={promiseLabel}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
