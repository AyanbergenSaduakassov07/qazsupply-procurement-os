"use client";

import { animate, durations, stagger, useAnimeScope, useReducedMotion } from "@qazsupply/motion";
import { Button } from "@qazsupply/ui/components/button";
import { type FormEvent, useId, useState } from "react";

import { type AskSentence, type AskTurn, askReport } from "../../app/ask-actions";
import { fill } from "../../lib/report-model";

export interface AskLabels {
  title: string;
  label: string;
  placeholder: string;
  submit: string;
  reading: string;
  aiLabel: string;
  cannot: string;
  cannotHint: string;
  suggestions: string[];
  dropped: string;
  cite: string;
  citeReport: string;
  you: string;
  answer: string;
  errors: Record<string, string>;
}

interface Exchange {
  id: number;
  question: string;
  answerable: boolean;
  sentences: AskSentence[];
  dropped: number;
}

/**
 * Ask about one released report. Answers are validated on the server before they arrive, so the
 * whole answer appears at once and sentences are revealed in order (instant with reduced motion).
 */
export function AskPanel({
  reportId,
  locale,
  labels,
  onCite,
  onCiteReport,
}: {
  reportId: string;
  locale: string;
  labels: AskLabels;
  onCite: (evidenceId: string) => void;
  onCiteReport: () => void;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<Exchange[]>([]);

  const root = useAnimeScope<HTMLOListElement>(
    (self) => {
      if (!self?.root) return;
      const last = (self.root as HTMLElement).lastElementChild;
      Array.from(last?.querySelectorAll("[data-sentence]") ?? []).forEach((el, i) => {
        animate(el, {
          opacity: [0, 1],
          translateY: reduced ? [0, 0] : [4, 0],
          duration: reduced ? 0 : durations.micro,
          delay: reduced ? 0 : stagger(i) * 3,
          ease: "outQuad",
        });
      });
    },
    [log.length, reduced],
  );

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    const history: AskTurn[] = log.flatMap((e) => [
      { role: "user" as const, text: e.question },
      { role: "assistant" as const, text: e.sentences.map((s) => s.text).join(" ") },
    ]);
    const result = await askReport(reportId, q, locale, history);
    setBusy(false);
    if (!result.ok) {
      setError(labels.errors[result.code] ?? labels.errors.unexpected ?? result.code);
      return;
    }
    setLog((l) => [...l, { id: l.length, question: q, ...result }]);
    setQuestion("");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(question);
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="space-y-3 rounded-[var(--qs-card-radius)] border border-line bg-surface p-4"
      data-testid="ask-panel"
    >
      <h2 id={`${id}-title`} className="text-lg font-semibold text-ink">
        {labels.title}
      </h2>
      <ol ref={root} className="space-y-4" aria-live="polite">
        {log.map((e) => (
          <li key={e.id} className="space-y-2" data-testid="ask-exchange">
            <p className="text-sm text-muted">
              <span className="font-medium">{labels.you}: </span>
              {e.question}
            </p>
            {e.answerable ? (
              <div className="space-y-2">
                <p className="text-xs text-muted">{labels.aiLabel}</p>
                {e.sentences.map((s) => (
                  <p
                    key={s.text}
                    data-sentence
                    className="text-base text-ink"
                    data-testid="ask-sentence"
                  >
                    {s.text}{" "}
                    {s.evidence_ids.map((ev, n) => (
                      <button
                        key={ev}
                        type="button"
                        onClick={() => onCite(ev)}
                        className="mx-0.5 inline-flex min-h-6 items-center rounded-full border border-line px-2 text-xs text-ink hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)]"
                        data-testid="ask-cite"
                      >
                        {fill(labels.cite, { n: n + 1 })}
                      </button>
                    ))}
                    {s.cites_report && (
                      <button
                        type="button"
                        onClick={onCiteReport}
                        className="mx-0.5 inline-flex min-h-6 items-center rounded-full border border-line px-2 text-xs text-ink hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)]"
                      >
                        {labels.citeReport}
                      </button>
                    )}
                  </p>
                ))}
                {e.dropped > 0 && <p className="text-xs text-muted">{labels.dropped}</p>}
              </div>
            ) : (
              <div className="rounded-md border border-line p-3" data-testid="ask-cannot">
                <p className="text-base font-medium text-ink">{labels.cannot}</p>
                <p className="mt-1 text-sm text-muted">{labels.cannotHint}</p>
              </div>
            )}
          </li>
        ))}
      </ol>
      {log.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {labels.suggestions.map((s) => (
            <Button
              key={s}
              size="sm"
              variant="secondary"
              onClick={() => void send(s)}
              disabled={busy}
            >
              {s}
            </Button>
          ))}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-2">
        <label htmlFor={`${id}-q`} className="block text-sm text-ink">
          {labels.label}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={`${id}-q`}
            value={question}
            maxLength={500}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={labels.placeholder}
            className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-base text-ink"
          />
          <Button type="submit" disabled={busy || !question.trim()}>
            {labels.submit}
          </Button>
        </div>
      </form>
      <p role="status" className="text-sm text-muted" data-testid="ask-status">
        {busy ? labels.reading : ""}
      </p>
      {error && (
        <p role="alert" className="text-sm text-[var(--qs-risk)]" data-testid="ask-error">
          {error}
        </p>
      )}
    </section>
  );
}
