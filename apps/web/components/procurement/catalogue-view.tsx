"use client";

import { Badge } from "@qazsupply/ui/components/badge";
import { Button } from "@qazsupply/ui/components/button";
import { Card, CardBody, CardHeader, CardTitle } from "@qazsupply/ui/components/card";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import {
  addCatalogueEntry,
  analogFeedback,
  catalogueAnalogs,
  cataloguePrices,
} from "../../app/procurement-actions";
import { fill } from "../../lib/procurement-labels";
import { dateFormatter, moneyFormatter } from "../../lib/report-model";

type Entry = {
  id: string;
  name: string;
  unit: string | null;
  attributes: Record<string, string>;
  standards: string[];
};
type Analog = { id: string; name: string; same: string[]; differs: string[] };
type Price = { on_date: string | null; price_kzt: string; source_name: string; source_row: number };
const INPUT = "min-h-11 w-full rounded border border-line bg-surface px-3 text-base text-ink";

export function CatalogueView(props: {
  l: Record<string, string>;
  locale: string;
  q: string;
  attr: string;
  results: Entry[];
  emptyReason: string | null;
  nameMatches: number;
  acceptance: string | null;
  canEdit: boolean;
}) {
  const { l, locale, results } = props;
  const id = useId();
  return (
    <div className="space-y-4">
      <search>
        <form method="get" className="grid gap-2 sm:grid-cols-[1fr_16rem_auto] sm:items-end">
          <label className="text-xs text-muted" htmlFor={`${id}-q`}>
            {l["cat.search"]}
            <input id={`${id}-q`} name="q" type="search" defaultValue={props.q} className={INPUT} />
          </label>
          <label className="text-xs text-muted" htmlFor={`${id}-a`}>
            {l["cat.filter"]}
            <input id={`${id}-a`} name="attr" defaultValue={props.attr} className={INPUT} />
          </label>
          <Button type="submit">{l["cat.search"]}</Button>
        </form>
      </search>
      {props.acceptance && (
        <p className="text-xs text-muted">
          {fill(l["cat.acceptance"] ?? "", {
            rate: `${Math.round(Number(props.acceptance) * 100)}%`,
          })}
        </p>
      )}
      {results.length === 0 ? (
        <p
          role="status"
          className="rounded border border-dashed border-line p-4 text-sm text-ink"
          data-testid="catalogue-empty"
        >
          {props.emptyReason === "filters_removed_all"
            ? fill(l["cat.filtersRemoved"] ?? "", { n: props.nameMatches })
            : l["cat.noName"]}
        </p>
      ) : (
        <ul className="space-y-2" data-testid="catalogue-results">
          {results.map((e) => (
            <EntryRow key={e.id} e={e} l={l} locale={locale} />
          ))}
        </ul>
      )}
      {props.canEdit && <AddEntry l={l} />}
    </div>
  );
}

function EntryRow({ e, l, locale }: { e: Entry; l: Record<string, string>; locale: string }) {
  const [analogs, setAnalogs] = useState<Analog[] | null>(null);
  const [prices, setPrices] = useState<Price[] | null>(null);
  const [status, setStatus] = useState("");
  const money = moneyFormatter(locale);
  const date = dateFormatter(locale);
  const open = async () => {
    const [a, p] = await Promise.all([catalogueAnalogs(e.id), cataloguePrices(e.id)]);
    setAnalogs(a.ok ? (a.data as unknown as Analog[]) : []);
    setPrices(p.ok ? (p.data as unknown as Price[]) : []);
  };
  return (
    <li>
      <details
        className="rounded border border-line bg-surface p-3"
        onToggle={(ev) => (ev.currentTarget.open && analogs === null ? void open() : undefined)}
      >
        <summary className="cursor-pointer">
          <span className="font-medium text-ink">{e.name}</span>
          <span className="ml-2 text-xs text-muted">
            {Object.entries(e.attributes)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ")}
          </span>
        </summary>
        <div className="mt-2 space-y-3 text-sm">
          <section>
            <h3 className="text-xs font-medium text-ink">{l["cat.analogs"]}</h3>
            {(analogs ?? []).map((a) => (
              <div
                key={a.id}
                className="mt-1 flex flex-wrap items-center gap-2"
                data-testid="analog"
              >
                <span className="text-ink">{a.name}</span>
                {a.same.length > 0 && (
                  <Badge variant="ok">
                    {l["cat.same"]}: {a.same.join(", ")}
                  </Badge>
                )}
                {a.differs.length > 0 && (
                  <Badge variant="gold">
                    {l["cat.differs"]}: {a.differs.join(", ")}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () =>
                    setStatus(
                      (await analogFeedback(e.id, a.id, true)).ok
                        ? (l["cat.feedbackSaved"] ?? "")
                        : (l.error ?? ""),
                    )
                  }
                >
                  {l["cat.acceptable"]}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () =>
                    setStatus(
                      (await analogFeedback(e.id, a.id, false)).ok
                        ? (l["cat.feedbackSaved"] ?? "")
                        : (l.error ?? ""),
                    )
                  }
                >
                  {l["cat.notAcceptable"]}
                </Button>
              </div>
            ))}
            <p role="status" aria-live="polite" className="text-xs text-muted">
              {status}
            </p>
          </section>
          <section>
            <h3 className="text-xs font-medium text-ink">{l["cat.prices"]}</h3>
            <ul className="text-xs text-muted tabular-nums">
              {(prices ?? []).map((p, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: price points have no stable id here
                <li key={i}>
                  {p.on_date ? date(p.on_date) : "—"} ·{" "}
                  {money(Math.round(Number(p.price_kzt) * 100))} · {p.source_name} #{p.source_row}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </details>
    </li>
  );
}

function AddEntry({ l }: { l: Record<string, string> }) {
  const id = useId();
  const router = useRouter();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [attrs, setAttrs] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{l["cat.add"]}</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="grid gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const attributes = Object.fromEntries(
              attrs
                .split("\n")
                .map((line) => line.split(":").map((s) => s.trim()))
                .filter((p) => p.length === 2 && p[0] && p[1]) as [string, string][],
            );
            const r = await addCatalogueEntry({ name, unit, attributes });
            if (r.ok) {
              setName("");
              setAttrs("");
              router.refresh();
            }
          }}
        >
          <label className="text-xs text-muted" htmlFor={`${id}-n`}>
            {l.item}
            <input
              id={`${id}-n`}
              required
              maxLength={255}
              className={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-xs text-muted" htmlFor={`${id}-u`}>
            {l.unit}
            <input
              id={`${id}-u`}
              maxLength={20}
              className={INPUT}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </label>
          <label className="text-xs text-muted" htmlFor={`${id}-a`}>
            {l["cat.attributes"]}
            <textarea
              id={`${id}-a`}
              rows={3}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-base text-ink"
              value={attrs}
              onChange={(e) => setAttrs(e.target.value)}
            />
          </label>
          <Button type="submit" className="justify-self-start">
            {l["cat.add"]}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
