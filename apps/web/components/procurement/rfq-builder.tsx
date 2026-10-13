"use client";

import type { Schemas } from "@qazsupply/api-client";
import { Badge } from "@qazsupply/ui/components/badge";
import { Button } from "@qazsupply/ui/components/button";
import { Card, CardBody, CardHeader, CardTitle } from "@qazsupply/ui/components/card";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { checkSpec, createRfq } from "../../app/procurement-actions";
import templates from "../../lib/rfq-templates.json";

type Item = { name: string; quantity: number; unit: string };
type Draft = { title: string; deadline: string; spec: string; items: Item[] };
const KEY = "qs.rfq.draft";
const INPUT = "min-h-11 w-full rounded border border-line bg-surface px-3 text-base text-ink";
const EMPTY: Draft = {
  title: "",
  deadline: "",
  spec: "",
  items: [{ name: "", quantity: 1, unit: "шт" }],
};

function load(): Draft | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function RfqBuilder({
  l,
  locale,
}: {
  l: Record<string, string>;
  locale: "kk" | "ru" | "en";
}) {
  const router = useRouter();
  const id = useId();
  const [d, setD] = useState<Draft>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [check, setCheck] = useState<Schemas["SpecOut"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = load();
    if (stored) setD(stored);
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(d));
      setSaved(true);
    } catch {
      setSaved(false); // private mode: the draft lives only in this tab
    }
  }, [d]);

  const applyTemplate = (name: keyof typeof templates.templates) => {
    const tpl = templates.templates[name];
    setD({
      ...d,
      title: d.title || l[`tpl.${name}`] || "",
      spec: tpl.spec[locale],
      items: tpl.items,
    });
    setCheck(null);
  };
  const runCheck = async () => {
    setBusy(true);
    const r = await checkSpec(d.spec);
    setBusy(false);
    if (r.ok) setCheck(r.data);
    else setError(l.error ?? "");
  };
  const setItem = (i: number, patch: Partial<Item>) =>
    setD({ ...d, items: d.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const create = async () => {
    setBusy(true);
    setError("");
    const r = await createRfq({
      title: d.title.trim(),
      deadline: d.deadline || null,
      spec_text: d.spec,
      items: d.items.filter((it) => it.name.trim()),
    });
    setBusy(false);
    if (!r.ok) return setError(l[`error.${r.code}`] ?? l.error ?? "");
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // nothing stored
    }
    router.push(`/${locale}/rfqs/${r.data.id}`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{l.templates}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          {(Object.keys(templates.templates) as (keyof typeof templates.templates)[]).map(
            (name) => (
              <Button key={name} variant="secondary" size="sm" onClick={() => applyTemplate(name)}>
                {l[`tpl.${name}`]}
              </Button>
            ),
          )}
        </CardBody>
      </Card>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <div className="space-y-1">
            <label htmlFor={`${id}-t`} className="text-sm font-medium text-ink">
              {l.title}
            </label>
            <input
              id={`${id}-t`}
              className={INPUT}
              required
              maxLength={255}
              value={d.title}
              onChange={(e) => setD({ ...d, title: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-d`} className="text-sm font-medium text-ink">
              {l.deadline}
            </label>
            <input
              id={`${id}-d`}
              type="date"
              className={INPUT}
              value={d.deadline}
              onChange={(e) => setD({ ...d, deadline: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-s`} className="text-sm font-medium text-ink">
            {l.spec}
          </label>
          <p id={`${id}-sh`} className="text-xs text-muted">
            {l.specHint}
          </p>
          <textarea
            id={`${id}-s`}
            aria-describedby={`${id}-sh`}
            rows={5}
            maxLength={50000}
            value={d.spec}
            onChange={(e) => {
              setD({ ...d, spec: e.target.value });
              setCheck(null);
            }}
            className="w-full rounded border border-line bg-surface px-3 py-2 text-base text-ink"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || !d.spec.trim()}
            onClick={() => void runCheck()}
          >
            {busy ? l.checking : l.check}
          </Button>
        </div>
        {check && (
          <SpecFindings
            check={check}
            l={l}
            onAccept={() => setD({ ...d, spec: check.suggested })}
          />
        )}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">{l.items}</legend>
          {d.items.map((it, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity until saved
              key={i}
              className="grid grid-cols-[1fr_6rem_6rem_auto] items-end gap-2"
              data-testid="item-row"
            >
              <label className="text-xs text-muted">
                {l.item}
                <input
                  className={INPUT}
                  value={it.name}
                  onChange={(e) => setItem(i, { name: e.target.value })}
                  required={i === 0}
                  maxLength={255}
                />
              </label>
              <label className="text-xs text-muted">
                {l.qty}
                <input
                  className={INPUT}
                  type="number"
                  min={0.0001}
                  step="any"
                  value={it.quantity}
                  onChange={(e) => setItem(i, { quantity: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs text-muted">
                {l.unit}
                <input
                  className={INPUT}
                  value={it.unit}
                  maxLength={20}
                  onChange={(e) => setItem(i, { unit: e.target.value })}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={d.items.length === 1}
                onClick={() => setD({ ...d, items: d.items.filter((_, k) => k !== i) })}
              >
                {l.removeItem}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setD({ ...d, items: [...d.items, { name: "", quantity: 1, unit: "шт" }] })
            }
          >
            {l.addItem}
          </Button>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-risk">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            {l.create}
          </Button>
          <span role="status" aria-live="polite" className="text-xs text-muted">
            {saved ? l.autosaved : ""}
          </span>
        </div>
      </form>
    </div>
  );
}

export function SpecFindings({
  check,
  l,
  onAccept,
}: {
  check: Schemas["SpecOut"];
  l: Record<string, string>;
  onAccept?: () => void;
}) {
  return (
    <Card data-testid="spec-findings">
      <CardBody className="space-y-3 text-sm">
        {check.issues.length === 0 ? (
          <p className="text-ok">{l.clean}</p>
        ) : (
          <ul className="space-y-1">
            {check.issues.map((i, k) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: issues are a fixed list per check
              <li key={k} className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    i.kind === "brand_lock" || i.kind === "conflicting_standards" ? "risk" : "gold"
                  }
                >
                  {l[`issue.${i.kind}`] ?? i.kind}
                </Badge>
                <span className="text-ink">{i.message}</span>
              </li>
            ))}
          </ul>
        )}
        {check.requirements.length > 0 && (
          <p className="text-xs text-muted">
            {l.extracted}:{" "}
            {check.requirements
              .map((q) => `${q.name ? `${q.name} ` : ""}${q.comparator} ${q.value} ${q.unit}`)
              .join("; ")}
            {check.standards.length ? ` · ${check.standards.join(", ")}` : ""}
          </p>
        )}
        {onAccept && check.suggested && check.issues.some((i) => i.suggestion) && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-ink">{l.suggestion}</p>
            <p
              className="rounded border border-line bg-surface-raised p-2 text-ink"
              data-testid="spec-suggested"
            >
              {check.suggested}
            </p>
            <Button type="button" size="sm" variant="secondary" onClick={onAccept}>
              {l.accept}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
