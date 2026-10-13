"use client";

import type { Schemas } from "@qazsupply/api-client";
import { Badge } from "@qazsupply/ui/components/badge";
import { Button } from "@qazsupply/ui/components/button";
import { Card, CardBody, CardHeader, CardTitle } from "@qazsupply/ui/components/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useId, useState } from "react";

import {
  confirmOffer,
  inviteSupplierToRfq,
  recordDecision,
  recordSent,
  rfqStep,
  submitOffer,
} from "../../app/procurement-actions";
import { fill } from "../../lib/procurement-labels";
import { dateFormatter, moneyFormatter } from "../../lib/report-model";

type Rfq = Schemas["RfqDetail"];
type Row = Record<string, unknown>;
type Item = { name: string; quantity: number; unit: string };
const STEPS = ["draft", "approved", "sent", "collecting", "closed", "decided"] as const;
const INPUT = "min-h-11 w-full rounded border border-line bg-surface px-3 text-base text-ink";

function useRun(l: Record<string, string>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (
    fn: () => Promise<{ ok: true } | { ok: false; code: string }>,
    after?: () => void,
  ) => {
    setBusy(true);
    setError("");
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(l[`error.${r.code}`] ?? l.error ?? r.code);
    after?.();
    router.refresh();
  };
  return { busy, error, run };
}

function Err({ text }: { text: string }) {
  return text ? (
    <p role="alert" className="text-sm text-risk">
      {text}
    </p>
  ) : null;
}

function Section({
  title,
  children,
  testId,
}: {
  title: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">{children}</CardBody>
    </Card>
  );
}

export function StatusBadge({ status, l }: { status: string; l: Record<string, string> }) {
  const variant =
    status === "decided"
      ? "ok"
      : status === "cancelled"
        ? "risk"
        : status === "draft"
          ? "neutral"
          : "accent";
  return (
    <Badge variant={variant} data-testid="rfq-status">
      {l[`status.${status}`] ?? status}
    </Badge>
  );
}

export function RfqDetail(props: {
  rfq: Rfq;
  l: Record<string, string>;
  locale: string;
  role: "buyer" | "approver" | "supplier" | "viewer";
  suppliers: { id: string; name: string }[];
}) {
  const { rfq, l, locale, role } = props;
  const version = rfq.versions.at(-1) as
    | { version: number; spec_text: string; items: Item[] }
    | undefined;
  const items = version?.items ?? [];
  const date = dateFormatter(locale);
  const buyer = role === "buyer" || role === "approver";
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-ink">{rfq.title}</h1>
          <StatusBadge status={rfq.status} l={l} />
        </div>
        <ol className="flex flex-wrap gap-1 text-xs" aria-label={l["col.status"]}>
          {STEPS.map((s) => (
            <li
              key={s}
              aria-current={rfq.status === s ? "step" : undefined}
              className={`rounded-full border px-2 py-0.5 ${rfq.status === s ? "border-[var(--qs-focus)] text-ink" : "border-line text-muted"}`}
            >
              {l[`status.${s}`]}
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted">
          {fill(l.version ?? "", { n: rfq.current_version })}
          {rfq.deadline ? ` · ${l.deadline}: ${date(rfq.deadline)}` : ""}
        </p>
      </header>
      <Section title={l.spec ?? ""}>
        <p className="whitespace-pre-wrap text-ink">{version?.spec_text || "—"}</p>
        <table className="w-full text-left">
          <thead className="text-xs text-muted">
            <tr>
              <th scope="col">{l.item}</th>
              <th scope="col">{l.qty}</th>
              <th scope="col">{l.unit}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: version items are positional
              <tr key={i} className="border-t border-line">
                <td className="py-1 text-ink">{it.name}</td>
                <td className="tabular-nums">{it.quantity}</td>
                <td>{it.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      {buyer && <Approval {...props} />}
      {buyer && <Invites {...props} />}
      {role === "supplier" ? (
        <SupplierOffer {...props} items={items} />
      ) : (
        <Offers {...props} items={items} />
      )}
      {buyer && !["decided", "cancelled"].includes(rfq.status) && <Closing {...props} />}
      {rfq.decision && <Memo {...props} />}
    </div>
  );
}

function Approval({ rfq, l, role }: { rfq: Rfq; l: Record<string, string>; role: string }) {
  const id = useId();
  const [note, setNote] = useState("");
  const { busy, error, run } = useRun(l);
  return (
    <Section title={l.approve ?? ""} testId="approval">
      <p className="text-xs text-muted">{l.approveHint}</p>
      {rfq.approvals.map((a, k) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: approvals are append-only
        <p key={k} className="text-ink">
          {fill(l.version ?? "", { n: String(a.version) })} ·{" "}
          {fill(l.approvedBy ?? "", {
            name: a.approved_by_me ? (l.you ?? "") : String(a.approved_by_staff ?? l.client),
          })}
        </p>
      ))}
      {rfq.status === "draft" &&
        (role === "approver" ? (
          <div className="flex flex-wrap items-end gap-2">
            <label htmlFor={`${id}-n`} className="sr-only">
              {l.reason}
            </label>
            <input
              id={`${id}-n`}
              className={`${INPUT} max-w-md`}
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              disabled={busy}
              onClick={() => void run(() => rfqStep(rfq.id, "approve", note))}
            >
              {l.approve}
            </Button>
          </div>
        ) : (
          <p className="text-muted">{l.onlyApprovers}</p>
        ))}
      <Err text={error} />
    </Section>
  );
}

function Invites({
  rfq,
  l,
  locale,
  suppliers,
}: {
  rfq: Rfq;
  l: Record<string, string>;
  locale: string;
  suppliers: { id: string; name: string }[];
}) {
  const id = useId();
  const date = dateFormatter(locale);
  const [sup, setSup] = useState(suppliers[0]?.id ?? "");
  const [channel, setChannel] = useState<"portal" | "email" | "phone" | "other">("email");
  const [email, setEmail] = useState("");
  const { busy, error, run } = useRun(l);
  const open = ["draft", "approved", "sent", "collecting"].includes(rfq.status);
  const canSend = ["approved", "sent", "collecting"].includes(rfq.status);
  return (
    <Section title={l.invites ?? ""} testId="invites">
      <p className="text-xs text-muted">{l.recordSentHint}</p>
      <ul className="space-y-2">
        {rfq.invites.map((i) => (
          <li key={String(i.id)} className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{String(i.supplier_name ?? "")}</span>
            <Badge variant="neutral">{l[`channel.${i.channel}`]}</Badge>
            {i.sent_at ? (
              <span className="text-xs text-muted">
                {fill(l.sentAt ?? "", { date: date(String(i.sent_at)) })}
              </span>
            ) : (
              <>
                <span className="text-xs text-muted">{l.notSent}</span>
                {canSend && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void run(() => recordSent(String(i.id)))}
                  >
                    {l.recordSent}
                  </Button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {open && (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_12rem_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () => inviteSupplierToRfq(rfq.id, sup, channel, email),
              () => setEmail(""),
            );
          }}
        >
          <label className="text-xs text-muted" htmlFor={`${id}-s`}>
            {l.supplier}
            <select
              id={`${id}-s`}
              className={INPUT}
              value={sup}
              onChange={(e) => setSup(e.target.value)}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted" htmlFor={`${id}-c`}>
            {l.channel}
            <select
              id={`${id}-c`}
              className={INPUT}
              value={channel}
              onChange={(e) => setChannel(e.target.value as typeof channel)}
            >
              {(["email", "portal", "phone", "other"] as const).map((c) => (
                <option key={c} value={c}>
                  {l[`channel.${c}`]}
                </option>
              ))}
            </select>
          </label>
          {channel === "portal" ? (
            <label className="text-xs text-muted" htmlFor={`${id}-e`}>
              {l.portalEmail}
              <input
                id={`${id}-e`}
                type="email"
                required
                className={INPUT}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          ) : (
            <span />
          )}
          <Button type="submit" variant="secondary" disabled={busy || !sup}>
            {l.invite}
          </Button>
        </form>
      )}
      <Err text={error} />
    </Section>
  );
}

function OfferForm({
  rfq,
  l,
  items,
  inviteId,
  source,
  testId,
}: {
  rfq: Rfq;
  l: Record<string, string>;
  items: Item[];
  inviteId: string;
  source: "portal" | "email";
  testId: string;
}) {
  const id = useId();
  const [currency, setCurrency] = useState("KZT");
  const [lead, setLead] = useState("");
  const [pay, setPay] = useState("");
  const [prices, setPrices] = useState<string[]>(items.map(() => ""));
  const { busy, error, run } = useRun(l);
  return (
    <form
      data-testid={testId}
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() =>
          submitOffer(rfq.id, {
            invite_id: inviteId,
            source,
            currency,
            lead_time_days: lead === "" ? null : Number(lead),
            payment_days: pay === "" ? null : Number(pay),
            lines: prices.map((p, i) => ({
              item: i,
              unit_price: p === "" ? null : Number(p.replace(",", ".")),
            })),
          }),
        );
      }}
    >
      {items.map((it, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: positional with the version items
        <label key={i} className="block text-xs text-muted" htmlFor={`${id}-p${i}`}>
          {it.name} · {l.unitPrice}
          <input
            id={`${id}-p${i}`}
            inputMode="decimal"
            className={INPUT}
            value={prices[i] ?? ""}
            onChange={(e) => setPrices(prices.map((p, k) => (k === i ? e.target.value : p)))}
          />
        </label>
      ))}
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted" htmlFor={`${id}-c`}>
          {l.currency}
          <select
            id={`${id}-c`}
            className={INPUT}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {["KZT", "USD", "EUR", "RUB", "CNY"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted" htmlFor={`${id}-l`}>
          {l.leadTime}
          <input
            id={`${id}-l`}
            type="number"
            min={0}
            max={730}
            className={INPUT}
            value={lead}
            onChange={(e) => setLead(e.target.value)}
          />
        </label>
        <label className="text-xs text-muted" htmlFor={`${id}-y`}>
          {l.payment}
          <input
            id={`${id}-y`}
            type="number"
            min={0}
            max={365}
            className={INPUT}
            value={pay}
            onChange={(e) => setPay(e.target.value)}
          />
        </label>
      </div>
      <Err text={error} />
      <Button type="submit" disabled={busy}>
        {l.submitOffer}
      </Button>
    </form>
  );
}

function OfferList({
  offers,
  l,
  items,
  buyer,
}: {
  offers: Row[];
  l: Record<string, string>;
  items: Item[];
  buyer: boolean;
}) {
  const [note, setNote] = useState<Record<string, string>>({});
  const { busy, error, run } = useRun(l);
  return (
    <ul className="space-y-3" data-testid="offers">
      {offers.map((o) => {
        const lines = (o.lines as { item: number; unit_price: string | null }[]) ?? [];
        return (
          <li key={String(o.id)} className="rounded border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{String(o.supplier_name ?? "")}</span>
              <Badge variant="neutral">{l[`channel.${o.source}`] ?? String(o.source)}</Badge>
              <Badge variant={o.confirmed ? "ok" : "gold"} data-testid="offer-state">
                {o.confirmed ? l.confirmed : l.unconfirmed}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted tabular-nums">
              {lines
                .map(
                  (ln) =>
                    `${items[ln.item]?.name ?? ln.item}: ${ln.unit_price ?? "—"} ${String(o.currency)}`,
                )
                .join(" · ")}
              {o.lead_time_days != null ? ` · ${l.leadTime}: ${o.lead_time_days}` : ""}
              {o.payment_days != null ? ` · ${l.payment}: ${o.payment_days}` : ""}
            </p>
            {buyer && !o.confirmed && (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="min-w-56 flex-1 text-xs text-muted">
                  {l.confirmNote}
                  <input
                    className={INPUT}
                    value={note[String(o.id)] ?? ""}
                    maxLength={2000}
                    onChange={(e) => setNote({ ...note, [String(o.id)]: e.target.value })}
                  />
                </label>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || !(note[String(o.id)] ?? "").trim()}
                  onClick={() =>
                    void run(() => confirmOffer(String(o.id), note[String(o.id)] ?? ""))
                  }
                >
                  {l.confirm}
                </Button>
              </div>
            )}
          </li>
        );
      })}
      <Err text={error} />
    </ul>
  );
}

function Offers({
  rfq,
  l,
  items,
  role,
  locale,
}: {
  rfq: Rfq;
  l: Record<string, string>;
  items: Item[];
  role: string;
  locale: string;
}) {
  const sent = rfq.invites.filter((i) => i.sent_at && i.channel !== "portal");
  const [inviteId, setInviteId] = useState(String(sent[0]?.id ?? ""));
  const collecting = rfq.status === "sent" || rfq.status === "collecting";
  return (
    <Section title={l.offers ?? ""}>
      <p className="text-xs text-muted">{l.confirmHint}</p>
      <OfferList
        offers={rfq.offers}
        l={l}
        items={items}
        buyer={role === "buyer" || role === "approver"}
      />
      {collecting && sent.length > 0 && role !== "viewer" && (
        <details className="rounded border border-line p-3">
          <summary className="cursor-pointer text-ink">{l.enterOffer}</summary>
          <label className="mt-2 block text-xs text-muted">
            {l.supplier}
            <select
              className={INPUT}
              value={inviteId}
              onChange={(e) => setInviteId(e.target.value)}
            >
              {sent.map((i) => (
                <option key={String(i.id)} value={String(i.id)}>
                  {String(i.supplier_name ?? "")}
                </option>
              ))}
            </select>
          </label>
          <OfferForm
            rfq={rfq}
            l={l}
            items={items}
            inviteId={inviteId}
            source="email"
            testId="buyer-offer-form"
          />
        </details>
      )}
      {["collecting", "closed", "decided"].includes(rfq.status) && rfq.offers.length > 0 && (
        <Link
          href={`/${locale}/rfqs/${rfq.id}/compare`}
          className="inline-flex min-h-11 items-center text-link underline-offset-2 hover:underline"
        >
          {l.compare}
        </Link>
      )}
    </Section>
  );
}

function SupplierOffer({ rfq, l, items }: { rfq: Rfq; l: Record<string, string>; items: Item[] }) {
  const mine = rfq.invites.find((i) => i.mine);
  const collecting = rfq.status === "sent" || rfq.status === "collecting";
  return (
    <Section title={l.yourOffer ?? ""} testId="supplier-offer">
      <OfferList offers={rfq.offers} l={l} items={items} buyer={false} />
      {collecting && mine && (
        <OfferForm
          rfq={rfq}
          l={l}
          items={items}
          inviteId={String(mine.id)}
          source="portal"
          testId="portal-offer-form"
        />
      )}
    </Section>
  );
}

function Closing({ rfq, l, role }: { rfq: Rfq; l: Record<string, string>; role: string }) {
  const id = useId();
  const { busy, error, run } = useRun(l);
  const confirmed = rfq.offers.filter((o) => o.confirmed);
  const [offer, setOffer] = useState(String(confirmed[0]?.id ?? ""));
  const [reason, setReason] = useState("");
  return (
    <Section title={l.decide ?? ""} testId="closing">
      <div className="flex flex-wrap gap-2">
        {(rfq.status === "sent" || rfq.status === "collecting") && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void run(() => rfqStep(rfq.id, "close"))}
          >
            {l.close}
          </Button>
        )}
        {!["decided", "cancelled"].includes(rfq.status) && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void run(() => rfqStep(rfq.id, "cancel"))}
          >
            {l.cancel}
          </Button>
        )}
      </div>
      {rfq.status === "closed" &&
        (role === "approver" ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => recordDecision(rfq.id, offer, reason));
            }}
          >
            <p className="text-xs text-muted">{l.decideHint}</p>
            <label className="block text-xs text-muted" htmlFor={`${id}-o`}>
              {l.chosen}
              <select
                id={`${id}-o`}
                className={INPUT}
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
              >
                {confirmed.map((o) => (
                  <option key={String(o.id)} value={String(o.id)}>
                    {String(o.supplier_name ?? "")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted" htmlFor={`${id}-r`}>
              {l.reason}
              <textarea
                id={`${id}-r`}
                required
                minLength={10}
                maxLength={4000}
                rows={3}
                className="w-full rounded border border-line bg-surface px-3 py-2 text-base text-ink"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy || reason.trim().length < 10 || !offer}>
              {l.decide}
            </Button>
          </form>
        ) : (
          <p className="text-muted">{l.onlyApprovers}</p>
        ))}
      <Err text={error} />
    </Section>
  );
}

function Memo({ rfq, l, locale }: { rfq: Rfq; l: Record<string, string>; locale: string }) {
  const d = rfq.decision as Row;
  const date = dateFormatter(locale);
  const money = moneyFormatter(locale);
  const alts = (d.alternatives as Row[]) ?? [];
  const who = d.decided_by_me ? (l.you ?? "") : String(d.decided_by_staff ?? l.client);
  return (
    <Section title={l.memo ?? ""} testId="memo">
      <p className="text-ink">
        {fill(l.memoBy ?? "", { date: date(String(d.created_at)), name: who })}
      </p>
      <blockquote className="border-l-2 border-line pl-3 text-ink">{String(d.reason)}</blockquote>
      <h3 className="text-sm font-medium text-ink">{l.alternatives}</h3>
      <ul className="space-y-1 text-xs text-muted">
        {alts.map((a) => (
          <li key={String(a.offer_id)}>
            {a.offer_id === d.offer_id ? `${l.chosen}: ` : ""}
            {String(a.supplier)} ·{" "}
            {a.total_kzt
              ? money(Math.round(Number(a.total_kzt) * 100))
              : (l[`cmp.excluded.${a.excluded}`] ?? "—")}
            {a.score ? ` · ${l["cmp.score"]}: ${Math.round(Number(a.score) * 100)}` : ""}
          </li>
        ))}
      </ul>
      <a
        href={`/${locale}/rfqs/${rfq.id}/decision-pdf`}
        className="inline-flex min-h-11 items-center text-link underline-offset-2 hover:underline"
      >
        {l.downloadPdf}
      </a>
    </Section>
  );
}
