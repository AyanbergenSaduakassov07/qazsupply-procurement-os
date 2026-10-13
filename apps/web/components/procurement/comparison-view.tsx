"use client";

import type { Schemas } from "@qazsupply/api-client";
import { Badge } from "@qazsupply/ui/components/badge";
import { Button } from "@qazsupply/ui/components/button";
import { Card, CardBody, CardHeader, CardTitle } from "@qazsupply/ui/components/card";
import { EmptyState } from "@qazsupply/ui/components/states";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveWeights } from "../../app/procurement-actions";
import { fill } from "../../lib/procurement-labels";
import { dateFormatter, moneyFormatter } from "../../lib/report-model";

type Cmp = Schemas["ComparisonOut"];
type Row = Schemas["ComparisonRow"];
const CRITERIA = ["price", "lead_time", "payment", "risk"] as const;
type Criterion = (typeof CRITERIA)[number];
const LOWER: Record<Criterion, boolean> = {
  price: true,
  lead_time: true,
  payment: false,
  risk: true,
};

function value(r: Row, c: Criterion): number | null {
  const v =
    c === "price"
      ? r.total_kzt
      : c === "lead_time"
        ? r.lead_time
        : c === "payment"
          ? r.payment
          : r.risk;
  return v == null ? null : Number(v);
}

export function ComparisonView({
  c,
  l,
  locale,
  canWeigh,
  rfqId,
}: {
  c: Cmp;
  l: Record<string, string>;
  locale: string;
  canWeigh: boolean;
  rfqId: string;
}) {
  const money = moneyFormatter(locale);
  const date = dateFormatter(locale);
  const ranked = c.rows
    .filter((r) => !r.excluded)
    .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
  const excluded = c.rows.filter((r) => r.excluded);
  const name = Object.fromEntries(c.rows.map((r) => [r.offer_id, r.supplier]));
  const best = Object.fromEntries(
    CRITERIA.map((k) => {
      const vals = ranked.map((r) => value(r, k)).filter((v): v is number => v != null);
      return [k, vals.length ? (LOWER[k] ? Math.min(...vals) : Math.max(...vals)) : null];
    }),
  ) as Record<Criterion, number | null>;
  const show = (r: Row, k: Criterion) => {
    const v = value(r, k);
    if (v == null) return "—";
    return k === "price" ? money(Math.round(v * 100)) : String(v);
  };
  if (c.rows.length === 0)
    return <EmptyState title={l["cmp.none"] ?? ""} message={l["cmp.intro"] ?? ""} />;
  const flips = c.sensitivity.filter((s) => s.changes && s.winner);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{l["cmp.intro"]}</p>
      {/* Desktop/tablet: criteria pinned left, offers as columns, header sticky. */}
      <div className="hidden max-h-[70vh] overflow-auto rounded-[var(--qs-card-radius)] border border-line bg-surface md:block">
        <table className="w-full border-separate border-spacing-0 text-sm" data-testid="comparison">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky top-0 left-0 z-20 bg-surface-raised px-3 py-2 text-left font-medium text-muted"
              >
                {l["cmp.criterion"]}
              </th>
              {ranked.map((r, i) => (
                <th
                  key={r.offer_id}
                  scope="col"
                  className="sticky top-0 z-10 bg-surface-raised px-3 py-2 text-left font-medium text-ink"
                >
                  {r.supplier}
                  {i === 0 && (
                    <Badge variant="ok" className="ml-2" data-testid="leader">
                      {l["cmp.leader"]}
                    </Badge>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map((k) => (
              <tr key={k}>
                <th
                  scope="row"
                  className="sticky left-0 bg-surface px-3 py-2 text-left font-normal text-muted"
                >
                  {l[`cmp.${k}`]}
                </th>
                {ranked.map((r) => {
                  const v = value(r, k);
                  const isBest = v != null && v === best[k];
                  return (
                    <td
                      key={r.offer_id}
                      className={`border-t border-line px-3 py-2 tabular-nums ${isBest ? "font-semibold text-ink" : "text-ink"}`}
                    >
                      {show(r, k)}
                      {isBest ? (
                        <span className="ml-1 text-xs text-ok">({l["cmp.best"]})</span>
                      ) : null}
                      {!isBest && v != null && best[k] != null && (
                        <span className="ml-1 text-xs text-muted">
                          {k === "price"
                            ? `+${money(Math.round(Math.abs(v - (best[k] ?? 0)) * 100))}`
                            : `${v - (best[k] ?? 0) > 0 ? "+" : ""}${v - (best[k] ?? 0)}`}
                        </span>
                      )}
                      {k === "price" && r.currency !== "KZT" && r.rate && r.rate_date && (
                        <span className="block text-xs text-muted">
                          {r.total} {r.currency} ·{" "}
                          {fill(l["cmp.rate"] ?? "", { rate: r.rate, date: date(r.rate_date) })}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th
                scope="row"
                className="sticky left-0 bg-surface px-3 py-2 text-left font-normal text-muted"
              >
                {l["cmp.landed"]}
              </th>
              {ranked.map((r) => (
                <td key={r.offer_id} className="border-t border-line px-3 py-2 text-xs text-muted">
                  {l["cmp.landedHint"]}
                </td>
              ))}
            </tr>
            <tr>
              <th
                scope="row"
                className="sticky left-0 bg-surface px-3 py-2 text-left font-medium text-ink"
              >
                {l["cmp.score"]}
              </th>
              {ranked.map((r) => (
                <td
                  key={r.offer_id}
                  className="border-t border-line px-3 py-2 font-semibold tabular-nums text-ink"
                >
                  {Math.round(Number(r.score ?? 0) * 100)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {/* Phone: one card per offer, same facts. */}
      <ul className="space-y-2 md:hidden" data-testid="comparison-cards">
        {ranked.map((r, i) => (
          <li key={r.offer_id}>
            <Card>
              <CardBody className="space-y-1 text-sm">
                <p className="font-medium text-ink">
                  {r.supplier} {i === 0 && <Badge variant="ok">{l["cmp.leader"]}</Badge>}
                </p>
                {CRITERIA.map((k) => (
                  <p key={k} className="flex justify-between gap-2">
                    <span className="text-muted">{l[`cmp.${k}`]}</span>
                    <span className="tabular-nums text-ink">
                      {show(r, k)}
                      {value(r, k) != null && value(r, k) === best[k] ? ` (${l["cmp.best"]})` : ""}
                    </span>
                  </p>
                ))}
                <p className="flex justify-between gap-2 font-semibold">
                  <span>{l["cmp.score"]}</span>
                  <span className="tabular-nums">{Math.round(Number(r.score ?? 0) * 100)}</span>
                </p>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{l["cmp.leaderHint"]}</p>
      {excluded.length > 0 && (
        <ul className="space-y-1 text-sm" data-testid="excluded">
          {excluded.map((r) => (
            <li key={r.offer_id} className="text-ink">
              {r.supplier}:{" "}
              <span className="text-muted">{l[`cmp.excluded.${r.excluded}`] ?? r.excluded}</span>
            </li>
          ))}
        </ul>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{l["cmp.sensitivity"]}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-1 text-sm" data-testid="sensitivity">
          {flips.length === 0 ? (
            <p className="text-ink">{l["cmp.stable"]}</p>
          ) : (
            flips.map((s) => (
              <p key={`${s.criterion}-${s.factor}`} className="text-ink">
                {fill(l["cmp.flip"] ?? "", {
                  criterion: (l[`cmp.${s.criterion}`] ?? String(s.criterion)).toLowerCase(),
                  factor: String(s.factor),
                  winner: name[String(s.winner)] ?? "",
                })}
              </p>
            ))
          )}
        </CardBody>
      </Card>
      {canWeigh && <Weights c={c} l={l} rfqId={rfqId} />}
    </div>
  );
}

function Weights({ c, l, rfqId }: { c: Cmp; l: Record<string, string>; rfqId: string }) {
  const router = useRouter();
  const [w, setW] = useState<Record<string, number>>(
    Object.fromEntries(CRITERIA.map((k) => [k, Math.round(Number(c.weights[k] ?? 0) * 100)])),
  );
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{l["cmp.weights"]}</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="grid gap-2 sm:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await saveWeights(
              rfqId,
              Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / 100])),
            );
            setBusy(false);
            router.refresh();
          }}
        >
          {CRITERIA.map((k) => (
            <label key={k} className="text-xs text-muted">
              {l[`cmp.${k}`]}
              <input
                type="number"
                min={0}
                max={100}
                value={w[k] ?? 0}
                onChange={(e) => setW({ ...w, [k]: Number(e.target.value) })}
                className="min-h-11 w-full rounded border border-line bg-surface px-3 text-base text-ink tabular-nums"
              />
            </label>
          ))}
          <Button
            type="submit"
            variant="secondary"
            disabled={busy}
            className="sm:col-span-4 sm:justify-self-start"
          >
            {l["cmp.saveWeights"]}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
