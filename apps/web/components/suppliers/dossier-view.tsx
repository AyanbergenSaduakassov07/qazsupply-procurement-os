"use client";

import type { Schemas } from "@qazsupply/api-client";
import { Badge } from "@qazsupply/ui/components/badge";
import { Button } from "@qazsupply/ui/components/button";
import { Card, CardBody, CardHeader, CardTitle } from "@qazsupply/ui/components/card";
import { EvidenceDrawer } from "@qazsupply/ui/components/evidence-drawer";
import { EmptyState } from "@qazsupply/ui/components/states";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useId, useRef, useState } from "react";

import { buildDossier, type Degraded, decideHit } from "../../app/supplier-actions";
import { dateFormatter, moneyFormatter } from "../../lib/report-model";
import { REASONS, type SupplierLabels } from "../../lib/supplier-labels";
import { OwnershipGraph } from "./ownership-graph";
import { type Verdict, VerdictBadge } from "./verdict";

type Dossier = Schemas["Dossier"];
type Screening = Schemas["Screening"];
type Hit = Schemas["Hit"];
const TABS = ["ownership", "legal", "screening", "spend", "score"] as const;
type Tab = (typeof TABS)[number];

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));

export function DossierView({
  dossier,
  labels,
  locale,
  canDecide,
  degraded,
}: {
  dossier: Dossier;
  labels: SupplierLabels;
  locale: string;
  canDecide: boolean;
  degraded: Degraded[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Degraded[]>(degraded);
  const [status, setStatus] = useState("");
  const supplier = dossier.supplier as { id: string; name: string; bin: string | null };
  const refresh = async () => {
    setBusy(true);
    setStatus(labels.refreshing);
    const r = await buildDossier(supplier.id);
    setBusy(false);
    if (!r.ok) return setStatus(labels.error);
    setNotes(r.degraded);
    setStatus(labels.refreshed);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-xl font-semibold text-ink">{supplier.name}</h1>
          <p className="mt-1 text-sm text-muted tabular-nums">
            {supplier.bin ? `BIN ${supplier.bin}` : labels.unresolved}
          </p>
        </div>
        <Badge variant="gold" title={labels.sampleHint}>
          {labels.sample}
        </Badge>
        {dossier.resolved && (
          <Button size="sm" variant="secondary" onClick={() => void refresh()} disabled={busy}>
            {busy ? labels.refreshing : labels.refresh}
          </Button>
        )}
      </header>
      <p className="text-xs text-muted">{labels.sampleHint}</p>
      <p role="status" aria-live="polite" className="sr-only" data-testid="dossier-status">
        {status}
      </p>
      {notes.length > 0 && (
        <div
          role="alert"
          data-testid="degraded"
          className="rounded-[var(--qs-radius-md)] border border-gold/50 bg-surface p-3 text-sm text-ink"
        >
          {notes.map((n) => (
            <p key={`${n.source_id}-${n.reason}-${n.bin ?? ""}`}>
              {fill(labels.degraded[n.reason] ?? labels.error, { bin: n.bin ?? "" })}
            </p>
          ))}
        </div>
      )}
      {!dossier.resolved ? (
        <EmptyState title={labels.unresolved} message={labels.unresolvedHint} />
      ) : !dossier.built || !dossier.risk ? (
        <EmptyState title={labels.notBuilt} message={labels.notBuiltHint} />
      ) : (
        <>
          <VerdictStrip dossier={dossier} labels={labels} />
          <Tabs dossier={dossier} labels={labels} locale={locale} canDecide={canDecide} />
        </>
      )}
    </div>
  );
}

function VerdictStrip({ dossier, labels }: { dossier: Dossier; labels: SupplierLabels }) {
  const risk = dossier.risk as NonNullable<Dossier["risk"]>;
  return (
    <Card data-testid="verdict-strip">
      <CardBody className="flex flex-wrap items-start gap-4">
        <div className="space-y-1">
          <VerdictBadge verdict={risk.verdict as Verdict} labels={labels.verdict} />
          <p className="text-sm text-ink tabular-nums">
            {fill(labels.score, { score: risk.score })}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-ink">{labels.reasons}</h2>
          {risk.top.length === 0 ? (
            <p className="text-sm text-muted">{labels.noReasons}</p>
          ) : (
            <ol
              className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-ink"
              data-testid="top-reasons"
            >
              {risk.top.map((code) => (
                <li key={code}>{labels.factor[code] ?? code}</li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-xs text-muted">{labels.notRating}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function Tabs(props: {
  dossier: Dossier;
  labels: SupplierLabels;
  locale: string;
  canDecide: boolean;
}) {
  const { labels } = props;
  const [tab, setTab] = useState<Tab>("ownership");
  const refs = useRef(new Map<Tab, HTMLButtonElement>());
  const id = useId();
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.indexOf(tab);
    const next =
      e.key === "ArrowRight"
        ? TABS[(i + 1) % TABS.length]
        : e.key === "ArrowLeft"
          ? TABS[(i - 1 + TABS.length) % TABS.length]
          : e.key === "Home"
            ? TABS[0]
            : e.key === "End"
              ? TABS[TABS.length - 1]
              : undefined; // prettier-ignore
    if (!next) return;
    e.preventDefault();
    setTab(next);
    refs.current.get(next)?.focus();
  };
  return (
    <div>
      <div
        role="tablist"
        aria-label={labels.tabs}
        className="flex flex-wrap gap-1 border-b border-line"
      >
        {TABS.map((t) => (
          <button
            key={t}
            ref={(el) => {
              if (el) refs.current.set(t, el);
            }}
            role="tab"
            type="button"
            id={`${id}-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`${id}-panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={onKey}
            className={`min-h-11 px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-[var(--qs-focus)] ${
              tab === t
                ? "border-b-2 border-[var(--qs-accent-strong)] font-medium text-ink"
                : "text-muted"
            }`}
          >
            {labels.tab[t]}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-${tab}`}
        aria-labelledby={`${id}-tab-${tab}`}
        className="pt-4"
      >
        {tab === "ownership" && <Ownership {...props} />}
        {tab === "legal" && <Legal {...props} />}
        {tab === "screening" && <ScreeningTab {...props} />}
        {tab === "spend" && <SpendTab {...props} />}
        {tab === "score" && <ScoreTab {...props} />}
      </div>
    </div>
  );
}

function flaggedIds(dossier: Dossier): Set<string> {
  return new Set(
    dossier.screenings
      .filter(
        (s) => s.list_source === "opensanctions" && s.hits.some((h) => h.decision !== "dismissed"),
      )
      .map((s) => s.subject_id),
  );
}

function Ownership({
  dossier,
  labels,
  locale,
  canDecide,
}: {
  dossier: Dossier;
  labels: SupplierLabels;
  locale: string;
  canDecide: boolean;
}) {
  const [view, setView] = useState<"graph" | "table">("graph");
  const [selected, setSelected] = useState<string | null>(null);
  const flagged = flaggedIds(dossier);
  const names = new Map(dossier.nodes.map((n) => [n.id, n.name]));
  const date = dateFormatter(locale);
  const company = dossier.company as NonNullable<Dossier["company"]>;
  const node = dossier.nodes.find((n) => n.id === selected);
  return (
    <div className="space-y-3">
      <fieldset className="flex flex-wrap items-center gap-3 text-sm">
        <legend className="sr-only">{labels["view.label"]}</legend>
        {(["graph", "table"] as const).map((v) => (
          <label key={v} className="flex min-h-11 items-center gap-2 text-ink">
            <input
              type="radio"
              name="ownership-view"
              checked={view === v}
              onChange={() => setView(v)}
              className="size-4"
            />
            {labels[`view.${v}`]}
          </label>
        ))}
      </fieldset>
      {view === "graph" ? (
        <OwnershipGraph
          nodes={dossier.nodes.map((n) => ({ ...n, flagged: flagged.has(n.id) }))}
          edges={dossier.edges.map((e) => ({
            ...e,
            share_pct: e.share_pct == null ? null : String(e.share_pct),
          }))}
          label={fill(labels.graphLabel, { name: company.name, count: dossier.nodes.length })}
          help={labels.graphHelp}
          roleNames={labels.roleName}
          flaggedLabel={labels.flagged}
          bornLabel={labels.born}
          onSelect={setSelected}
          selected={selected}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="ownership-table">
            <thead className="text-muted">
              <tr>
                {[labels.owner, labels.role, labels.share, labels.owned, labels.source].map((h) => (
                  <th key={h} scope="col" className="px-2 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dossier.edges.map((e) => (
                <tr key={`${e.owner_id}-${e.owned_id}-${e.role}`} className="border-t border-line">
                  <td className="px-2 py-2 text-ink">
                    {names.get(e.owner_id)}
                    {flagged.has(e.owner_id) && (
                      <Badge variant="risk" className="ml-2">
                        {labels.flagged}
                      </Badge>
                    )}
                  </td>
                  <td className="px-2 py-2">{labels.roleName[e.role] ?? e.role}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {e.share_pct == null ? "—" : `${Number(e.share_pct)}%`}
                  </td>
                  <td className="px-2 py-2">{names.get(e.owned_id)}</td>
                  <td className="px-2 py-2 text-xs text-muted">
                    {e.source_id} · {date(e.fetched_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {node && (
        <Card data-testid="party-details">
          <CardHeader>
            <CardTitle>{node.name}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <p className="text-muted">
              {labels.kind[node.kind]}
              {node.birth_year ? ` · ${fill(labels.born, { year: node.birth_year })}` : ""}
              {node.country ? ` · ${node.country}` : ""}
              {node.bin ? ` · BIN ${node.bin}` : ""}
            </p>
            <p className="text-xs text-muted">
              {labels.source}: {node.source_id} · {labels.fetched}: {date(node.fetched_at)}
            </p>
            {dossier.screenings
              .filter((s) => s.subject_id === node.id)
              .map((s) => (
                <ScreeningCard
                  key={s.id}
                  s={s}
                  subject={node.name}
                  labels={labels}
                  locale={locale}
                  canDecide={canDecide}
                />
              ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Legal({
  dossier,
  labels,
  locale,
}: {
  dossier: Dossier;
  labels: SupplierLabels;
  locale: string;
}) {
  const c = dossier.company as NonNullable<Dossier["company"]>;
  const date = dateFormatter(locale);
  const rnu = dossier.screenings.find(
    (s) => s.subject_id === c.id && s.list_source === "goszakup_rnu",
  );
  const listed = rnu?.hits.find((h) => h.decision !== "dismissed");
  const ex = (listed?.explanation ?? {}) as Record<string, string>;
  const rows: [string, string][] = [
    [
      labels.status,
      c.registry_status ? (labels.statusName[c.registry_status] ?? c.registry_status) : "—",
    ],
    [labels.registered, c.registered_on ? date(c.registered_on) : "—"],
    [labels.country, c.country ?? "—"],
    [labels.source, `${c.source_id} · ${c.licence}`],
    [labels.fetched, date(c.fetched_at)],
  ];
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div
        data-testid="rnu"
        className="rounded-[var(--qs-radius-md)] border border-line p-3 text-sm"
      >
        {listed ? (
          <>
            <p className="font-medium text-risk">
              {fill(labels["rnu.listed"], { until: ex.until ? date(ex.until) : "—" })}
            </p>
            <p className="mt-1 text-ink">
              {labels["rnu.reason"]}: {ex[`reason_${locale}`] ?? ex.reason_en}
            </p>
          </>
        ) : (
          <p className="text-ink">{labels["rnu.clear"]}</p>
        )}
        {rnu && (
          <p className="mt-1 text-xs text-muted">
            {fill(labels.checked, { date: date(rnu.checked_at), version: rnu.list_version })}
          </p>
        )}
      </div>
    </div>
  );
}

function ScreeningTab({
  dossier,
  labels,
  locale,
  canDecide,
}: {
  dossier: Dossier;
  labels: SupplierLabels;
  locale: string;
  canDecide: boolean;
}) {
  const names = new Map(dossier.nodes.map((n) => [n.id, n.name]));
  const runs = dossier.screenings.filter((s) => s.list_source === "opensanctions");
  const withHits = runs.filter((s) => s.hits.length);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{labels.neverBlocks}</p>
      <p className="text-sm text-ink">
        {labels.list.opensanctions}:{" "}
        {fill(labels.clearCount, { clear: runs.length - withHits.length, total: runs.length })}
      </p>
      {withHits.map((s) => (
        <ScreeningCard
          key={s.id}
          s={s}
          subject={names.get(s.subject_id) ?? ""}
          labels={labels}
          locale={locale}
          canDecide={canDecide}
        />
      ))}
      {dossier.items.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-ink">
            {labels.items} · {labels.list.dualuse}
          </h3>
          {dossier.items
            .filter((s) => s.hits.length)
            .map((s) => (
              <ScreeningCard
                key={s.id}
                s={s}
                subject=""
                labels={labels}
                locale={locale}
                canDecide={canDecide}
              />
            ))}
        </section>
      )}
    </div>
  );
}

function ScreeningCard({
  s,
  subject,
  labels,
  locale,
  canDecide,
}: {
  s: Screening;
  subject: string;
  labels: SupplierLabels;
  locale: string;
  canDecide: boolean;
}) {
  const date = dateFormatter(locale);
  return (
    <Card data-testid="screening">
      <CardBody className="space-y-3">
        <p className="text-sm text-ink">
          <span className="font-medium">{subject}</span> ·{" "}
          {labels.list[s.list_source] ?? s.list_source}
        </p>
        <p className="text-xs text-muted">
          {fill(labels.checked, { date: date(s.checked_at), version: s.list_version })}
        </p>
        {s.hits.length === 0 && <p className="text-sm text-ink">{labels.clear}</p>}
        {s.hits.map((h) => (
          <HitRow key={h.id} h={h} labels={labels} canDecide={canDecide} />
        ))}
      </CardBody>
    </Card>
  );
}

function HitRow({ h, labels, canDecide }: { h: Hit; labels: SupplierLabels; canDecide: boolean }) {
  const ex = h.explanation as {
    pairs?: [string, string, number][];
    party_birth_year?: number | null;
    entry_birth_year?: number | null;
    program?: string;
  };
  const state = h.decision ?? "open";
  const who = h.decided_by_me ? labels["hit.you"] : (h.decided_by_staff ?? labels["hit.client"]);
  return (
    <div data-testid="hit" className="rounded-[var(--qs-radius-md)] border border-line p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{h.entry_name}</span>
        <Badge
          variant={state === "confirmed" ? "risk" : state === "dismissed" ? "neutral" : "gold"}
          data-testid="hit-state"
        >
          {labels[`hit.${state}`]}
          {h.decision ? ` · ${fill(labels["hit.by"], { name: who })}` : ""}
        </Badge>
        <span className="text-xs text-muted tabular-nums">
          {fill(labels["hit.match"], { score: Math.round(Number(h.score)) })}
        </span>
      </div>
      {ex.pairs && (
        <p className="mt-1 text-xs text-muted">
          {labels["hit.pairs"]}:{" "}
          {ex.pairs.map(([a, b, r]) => `${a} ≈ ${b} (${Math.round(r)}%)`).join(", ")}
        </p>
      )}
      {(ex.party_birth_year || ex.entry_birth_year) && (
        <p className="text-xs text-muted">
          {fill(labels["hit.born"], {
            a: ex.party_birth_year ?? "—",
            b: ex.entry_birth_year ?? "—",
          })}
        </p>
      )}
      {ex.program && (
        <p className="text-xs text-muted">
          {labels["hit.list"]}: {ex.program}
        </p>
      )}
      {h.reason_code && (
        <p className="text-xs text-muted">
          {labels.reason[h.reason_code] ?? h.reason_code}
          {h.note ? ` — ${h.note}` : ""}
        </p>
      )}
      {canDecide ? (
        <DecisionForm hitId={h.id} labels={labels} />
      ) : (
        !h.decision && <p className="mt-2 text-xs text-muted">{labels["decide.noRights"]}</p>
      )}
    </div>
  );
}

function DecisionForm({ hitId, labels }: { hitId: string; labels: SupplierLabels }) {
  const router = useRouter();
  const id = useId();
  const [mode, setMode] = useState<"confirmed" | "dismissed" | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!mode || !reason) return;
    if (reason === "other" && !note.trim()) return setError(labels["decide.noteRequired"]);
    setBusy(true);
    const r = await decideHit(hitId, mode, reason, note);
    setBusy(false);
    if (!r.ok) return setError(r.code === "forbidden" ? labels["decide.noRights"] : labels.error);
    setMode(null);
    router.refresh();
  };
  if (!mode)
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setMode("confirmed");
            setReason(REASONS.confirmed[0]);
          }}
        >
          {labels["decide.confirm"]}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setMode("dismissed");
            setReason(REASONS.dismissed[0]);
          }}
        >
          {labels["decide.dismiss"]}
        </Button>
      </div>
    );
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label htmlFor={`${id}-r`} className="block text-xs text-muted">
        {labels["decide.reason"]}
      </label>
      <select
        id={`${id}-r`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="min-h-11 w-full rounded border border-line bg-surface px-2 text-ink"
      >
        {REASONS[mode].map((r) => (
          <option key={r} value={r}>
            {labels.reason[r]}
          </option>
        ))}
      </select>
      <label htmlFor={`${id}-n`} className="block text-xs text-muted">
        {labels["decide.note"]}
      </label>
      <textarea
        id={`${id}-n`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={2000}
        aria-describedby={`${id}-h`}
        className="w-full rounded border border-line bg-surface px-2 py-1 text-ink"
        rows={2}
      />
      <p id={`${id}-h`} className="text-xs text-muted">
        {labels["decide.noteHint"]}
      </p>
      {error && (
        <p role="alert" className="text-xs text-risk">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          {labels["decide.save"]}
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => setMode(null)}>
          {labels.drawer.close}
        </Button>
      </div>
    </form>
  );
}

function SpendTab({
  dossier,
  labels,
  locale,
}: {
  dossier: Dossier;
  labels: SupplierLabels;
  locale: string;
}) {
  const [open, setOpen] = useState(false);
  const sp = dossier.spend;
  const money = moneyFormatter(locale);
  const date = dateFormatter(locale);
  const total = money(Math.round(Number(sp.total_kzt) * 100));
  const sources = (sp.evidence.sources ?? []) as {
    id: string;
    file_name: string;
    source_row: number;
    item_text: string | null;
    supplier_text: string | null;
    quantity: string | null;
    unit_price_kzt: string | null;
    purchased_on: string | null;
  }[]; // prettier-ignore
  if (sp.lines === 0)
    return <EmptyState title={labels["spend.none"]} message={labels.sampleHint} />;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">{labels["spend.total"]}</dt>
          <dd>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="min-h-11 text-lg font-semibold text-ink underline decoration-dotted tabular-nums"
              aria-label={`${labels.openEvidence}: ${total}`}
              data-testid="spend-total"
            >
              {total}
            </button>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{labels["spend.lines"]}</dt>
          <dd className="text-lg text-ink tabular-nums">{sp.lines}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{labels["spend.period"]}</dt>
          <dd className="text-sm text-ink">
            {sp.first_on ? date(sp.first_on) : "—"} – {sp.last_on ? date(sp.last_on) : "—"}
          </dd>
        </div>
      </dl>
      {sp.unpriced > 0 && (
        <p className="text-xs text-muted">{fill(labels["spend.unpriced"], { n: sp.unpriced })}</p>
      )}
      <EvidenceDrawer
        open={open}
        onOpenChange={setOpen}
        labels={labels.drawer}
        evidence={{
          id: `spend-${(dossier.supplier as { id: string }).id}`,
          computationId: "supplier360.spend",
          method: "sql",
          codeVersion: "supplier360",
          confidence: "1",
          formula: labels["spend.formula"],
          result: total,
          sources: sources.map((r) => ({
            id: r.id,
            fileName: r.file_name,
            sourceRow: r.source_row,
            itemText: r.item_text ?? undefined,
            supplierText: r.supplier_text ?? undefined,
            quantity: r.quantity ?? undefined,
            unitPrice: r.unit_price_kzt ?? undefined,
            currency: "KZT",
            purchasedOn: r.purchased_on ?? undefined,
          })),
        }}
      />
    </div>
  );
}

function ScoreTab({ dossier, labels }: { dossier: Dossier; labels: SupplierLabels }) {
  const risk = dossier.risk as NonNullable<Dossier["risk"]>;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="factors">
          <thead className="text-muted">
            <tr>
              <th scope="col" className="px-2 py-2 font-medium">
                {labels.reasons}
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {labels["factor.weight"]}
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {labels["factor.points"]}
              </th>
            </tr>
          </thead>
          <tbody>
            {risk.factors.map((f) => (
              <tr key={f.code} className="border-t border-line">
                <td className="px-2 py-2 text-ink">
                  {labels.factor[f.code] ?? f.code}
                  <span className="ml-2 text-xs text-muted">
                    {f.triggered ? labels["factor.on"] : labels["factor.off"]}
                  </span>
                </td>
                <td className="px-2 py-2 tabular-nums">{f.weight}</td>
                <td className="px-2 py-2 tabular-nums">{f.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">{labels.ai}</p>
    </div>
  );
}
