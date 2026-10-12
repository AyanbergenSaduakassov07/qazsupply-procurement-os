"use client";

import type { Schemas } from "@qazsupply/api-client";
import { Badge } from "@qazsupply/ui/components/badge";
import { Button } from "@qazsupply/ui/components/button";
import { Card, CardBody, CardHeader, CardTitle } from "@qazsupply/ui/components/card";
import { useRouter } from "next/navigation";
import { type ReactNode, useId, useRef, useState } from "react";

import {
  decideCase,
  inviteSupplier,
  type Result,
  saveDetails,
  submitCase,
  uploadDocument,
} from "../../app/onboarding-actions";
import { KINDS, type OnboardingLabels } from "../../lib/onboarding-labels";
import { dateFormatter } from "../../lib/report-model";

type Case = Schemas["CaseDetail"];
const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
const INPUT = "min-h-11 w-full rounded border border-line bg-surface px-3 text-base text-ink";

function useAction(labels: OnboardingLabels) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<Result>, after?: () => void) => {
    setBusy(true);
    setError("");
    const r = await fn();
    setBusy(false);
    if (!r.ok) {
      setError(labels.errors[r.code] ?? labels.errors.unexpected ?? r.code);
      return false;
    }
    after?.();
    router.refresh();
    return true;
  };
  return { busy, error, run };
}

function Field({
  label,
  hint,
  children,
  id,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function StatusBadge({ status, labels }: { status: string; labels: OnboardingLabels }) {
  const variant =
    status === "approved"
      ? "ok"
      : status === "rejected"
        ? "risk"
        : status === "submitted"
          ? "gold"
          : "neutral";
  return (
    <Badge variant={variant} data-testid="case-status">
      {labels.status[status] ?? status}
    </Badge>
  );
}

function Documents({ c, labels, locale }: { c: Case; labels: OnboardingLabels; locale: string }) {
  const date = dateFormatter(locale);
  if (c.documents.length === 0) return <p className="text-sm text-muted">{labels.noDocs}</p>;
  return (
    <ul className="space-y-2" data-testid="documents">
      {c.documents.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-ink">{labels.kindName[d.kind] ?? d.kind}</span>
          <span className="text-muted">
            {d.file_name}
            {d.doc_number ? ` · № ${d.doc_number}` : ""}
            {d.issued_on ? ` · ${date(d.issued_on)}` : ""}
          </span>
          <Badge variant={d.fields_confirmed ? "ok" : "neutral"}>
            {d.fields_confirmed ? labels.confirmed : labels.notConfirmed}
          </Badge>
          <a
            href={`/${locale}/onboarding/${c.id}/documents/${d.id}`}
            className="inline-flex min-h-11 items-center text-link underline-offset-2 hover:underline"
          >
            {labels.download}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Supplier side: three steps, one column, saved as you go. */
export function OnboardingWizard({
  c,
  labels,
  locale,
}: {
  c: Case;
  labels: OnboardingLabels;
  locale: string;
}) {
  const editable = c.status === "invited" || c.status === "in_progress";
  const [step, setStep] = useState(c.legal_name && c.bin ? 2 : 1);
  const heading = useRef<HTMLHeadingElement>(null);
  const go = (n: number) => {
    setStep(n);
    requestAnimationFrame(() => heading.current?.focus());
  };
  if (!editable) {
    return (
      <Card>
        <CardBody className="space-y-2">
          <StatusBadge status={c.status} labels={labels} />
          {c.status === "submitted" && <p className="text-sm text-ink">{labels.submittedHint}</p>}
          {c.decision_note && (
            <p className="text-sm text-ink">
              {fill(labels.decisionNote, { note: c.decision_note })}
            </p>
          )}
          <Documents c={c} labels={labels} locale={locale} />
        </CardBody>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {c.decision_note && c.status === "in_progress" && (
        <p role="alert" className="rounded border border-gold/50 p-3 text-sm text-ink">
          {fill(labels.returned, { note: c.decision_note })}
        </p>
      )}
      <ol className="flex gap-2 text-xs" aria-label={fill(labels.step, { n: step })}>
        {[labels.step1, labels.step2, labels.step3].map((s, i) => (
          <li
            key={s}
            aria-current={step === i + 1 ? "step" : undefined}
            className={`flex-1 rounded-full border px-2 py-1 text-center ${step === i + 1 ? "border-[var(--qs-focus)] text-ink" : "border-line text-muted"}`}
          >
            {s}
          </li>
        ))}
      </ol>
      <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold text-ink outline-none">
        {fill(labels.step, { n: step })}: {[labels.step1, labels.step2, labels.step3][step - 1]}
      </h2>
      {step === 1 && <DetailsStep c={c} labels={labels} onDone={() => go(2)} />}
      {step === 2 && (
        <div className="space-y-4">
          <Documents c={c} labels={labels} locale={locale} />
          <UploadStep c={c} labels={labels} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => go(1)}>
              {labels.back}
            </Button>
            <Button onClick={() => go(3)} disabled={c.documents.length === 0}>
              {labels.next}
            </Button>
          </div>
        </div>
      )}
      {step === 3 && <SubmitStep c={c} labels={labels} locale={locale} onBack={() => go(2)} />}
    </div>
  );
}

function DetailsStep({
  c,
  labels,
  onDone,
}: {
  c: Case;
  labels: OnboardingLabels;
  onDone: () => void;
}) {
  const id = useId();
  const { busy, error, run } = useAction(labels);
  const [v, setV] = useState({
    legal_name: c.legal_name ?? "",
    bin: c.bin ?? "",
    contact_name: c.contact_name ?? "",
    contact_phone: c.contact_phone ?? "",
  });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => saveDetails(c.id, v), onDone);
      }}
    >
      <Field id={`${id}-n`} label={labels.legalName}>
        <input
          id={`${id}-n`}
          className={INPUT}
          value={v.legal_name}
          onChange={set("legal_name")}
          required
          maxLength={255}
          autoComplete="organization"
        />
      </Field>
      <Field id={`${id}-b`} label={labels.bin} hint={labels.binHint}>
        <input
          id={`${id}-b`}
          className={INPUT}
          value={v.bin}
          onChange={set("bin")}
          required
          inputMode="numeric"
          pattern="[0-9]{12}"
          maxLength={12}
          aria-describedby={`${id}-b-hint`}
        />
      </Field>
      <Field id={`${id}-c`} label={labels.contactName}>
        <input
          id={`${id}-c`}
          className={INPUT}
          value={v.contact_name}
          onChange={set("contact_name")}
          maxLength={255}
          autoComplete="name"
        />
      </Field>
      <Field id={`${id}-p`} label={labels.contactPhone}>
        <input
          id={`${id}-p`}
          type="tel"
          className={INPUT}
          value={v.contact_phone}
          onChange={set("contact_phone")}
          autoComplete="tel"
        />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-risk">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {labels.save}
      </Button>
    </form>
  );
}

function UploadStep({ c, labels }: { c: Case; labels: OnboardingLabels }) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const { busy, error, run } = useAction(labels);
  const [done, setDone] = useState("");
  return (
    <form
      ref={form}
      className="space-y-3 rounded border border-line p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.set("fields_confirmed", data.get("fields_confirmed") ? "true" : "false");
        setDone("");
        void run(
          () => uploadDocument(c.id, data),
          () => {
            form.current?.reset();
            setDone(labels.uploaded);
          },
        );
      }}
    >
      <Field id={`${id}-k`} label={labels.kind}>
        <select
          id={`${id}-k`}
          name="kind"
          className={INPUT}
          defaultValue="registration_certificate"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {labels.kindName[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${id}-f`} label={labels.file}>
        <input
          id={`${id}-f`}
          name="file"
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          required
          className="block min-h-11 w-full text-sm text-ink"
          data-testid="doc-file"
        />
      </Field>
      <Field id={`${id}-d`} label={labels.docNumber}>
        <input id={`${id}-d`} name="doc_number" className={INPUT} maxLength={100} />
      </Field>
      <Field id={`${id}-i`} label={labels.issuedOn}>
        <input id={`${id}-i`} name="issued_on" type="date" className={INPUT} />
      </Field>
      <label className="flex min-h-11 items-start gap-2 text-sm text-ink">
        <input
          name="fields_confirmed"
          type="checkbox"
          className="mt-1 size-5"
          aria-describedby={`${id}-ch`}
        />
        <span>{labels.confirmFields}</span>
      </label>
      <p id={`${id}-ch`} className="text-xs text-muted">
        {labels.confirmHint}
      </p>
      {error && (
        <p role="alert" className="text-sm text-risk">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite" className="text-sm text-ok">
        {done}
      </p>
      <Button type="submit" variant="secondary" disabled={busy}>
        {labels.upload}
      </Button>
    </form>
  );
}

function SubmitStep({
  c,
  labels,
  locale,
  onBack,
}: {
  c: Case;
  labels: OnboardingLabels;
  locale: string;
  onBack: () => void;
}) {
  const { busy, error, run } = useAction(labels);
  const [declared, setDeclared] = useState(false);
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{labels.legalName}</dt>
        <dd className="text-ink">{c.legal_name ?? "—"}</dd>
        <dt className="text-muted">{labels.bin}</dt>
        <dd className="text-ink tabular-nums">{c.bin ?? "—"}</dd>
        <dt className="text-muted">{labels.contactName}</dt>
        <dd className="text-ink">{c.contact_name ?? "—"}</dd>
      </dl>
      <Documents c={c} labels={labels} locale={locale} />
      <label className="flex min-h-11 items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={declared}
          onChange={(e) => setDeclared(e.target.checked)}
          className="mt-1 size-5"
        />
        <span>{labels.declare}</span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-risk">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack}>
          {labels.back}
        </Button>
        <Button onClick={() => void run(() => submitCase(c.id))} disabled={busy || !declared}>
          {labels.submit}
        </Button>
      </div>
    </div>
  );
}

/** Buyer side: the human check. */
export function OnboardingReview({
  c,
  labels,
  locale,
  canDecide,
}: {
  c: Case;
  labels: OnboardingLabels;
  locale: string;
  canDecide: boolean;
}) {
  const id = useId();
  const { busy, error, run } = useAction(labels);
  const [note, setNote] = useState("");
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center gap-2">
        <CardTitle>{c.legal_name ?? c.supplier_name ?? "—"}</CardTitle>
        <StatusBadge status={c.status} labels={labels} />
      </CardHeader>
      <CardBody className="space-y-3">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{labels.bin}</dt>
          <dd className="text-ink tabular-nums">{c.bin ?? "—"}</dd>
          <dt className="text-muted">{labels.contactName}</dt>
          <dd className="text-ink">{c.contact_name ?? "—"}</dd>
          <dt className="text-muted">{labels.contactPhone}</dt>
          <dd className="text-ink">{c.contact_phone ?? "—"}</dd>
        </dl>
        {c.supplier_bin && c.bin && c.supplier_bin !== c.bin && (
          <p
            role="alert"
            data-testid="bin-mismatch"
            className="rounded border border-risk/50 p-2 text-sm text-risk"
          >
            {fill(labels.binMismatch, { declared: c.bin, record: c.supplier_bin })}
          </p>
        )}
        <h3 className="text-sm font-medium text-ink">{labels.docs}</h3>
        <Documents c={c} labels={labels} locale={locale} />
        {c.decision_note && (
          <p className="text-sm text-ink">{fill(labels.decisionNote, { note: c.decision_note })}</p>
        )}
        {canDecide && c.status === "submitted" && (
          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-sm text-muted">{labels.humanCheck}</p>
            <Field id={`${id}-n`} label={labels.note} hint={labels.noteHint}>
              <textarea
                id={`${id}-n`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                rows={2}
                className="w-full rounded border border-line bg-surface px-3 py-2 text-ink"
                aria-describedby={`${id}-n-hint`}
              />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-risk">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => void run(() => decideCase(c.id, "approve", note))}
              >
                {labels.approve}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void run(() => decideCase(c.id, "return", note))}
              >
                {labels.return}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void run(() => decideCase(c.id, "reject", note))}
              >
                {labels.reject}
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/** Buyer: create a request for a supplier member; the buyer sends the link themselves. */
export function InviteForm({
  supplierId,
  labels,
  locale,
}: {
  supplierId: string;
  labels: OnboardingLabels;
  locale: string;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState("");
  const { busy, error, run } = useAction(labels);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setDone("");
        void run(async () => {
          const r = await inviteSupplier(supplierId, email);
          if (r.ok && r.id)
            setDone(fill(labels.inviteDone, { link: `/${locale}/onboarding/${r.id}` }));
          return r;
        });
      }}
    >
      <div className="min-w-56 flex-1">
        <Field id={`${id}-e`} label={labels.inviteEmail}>
          <input
            id={`${id}-e`}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
            autoComplete="off"
          />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={busy}>
        {labels.inviteSend}
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-risk">
          {error}
        </p>
      )}
      <p
        role="status"
        aria-live="polite"
        className="w-full text-sm text-ink"
        data-testid="invite-done"
      >
        {done}
      </p>
    </form>
  );
}
