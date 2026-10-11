"use client";

import { Badge } from "@qazsupply/ui/components/badge";
import { Button } from "@qazsupply/ui/components/button";
import { EmptyState } from "@qazsupply/ui/components/states";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { reviewLine } from "../../app/spend-actions";

export interface QueueCandidate {
  code: string;
  score: number;
  matched: string[];
  name: string;
}

export interface QueueItem {
  id: string;
  item_text: string | null;
  supplier_text: string | null;
  unit_price: number | null;
  currency: string | null;
  purchased_on: string | null;
  match_status: string;
  match_candidates: QueueCandidate[];
  source_row: number;
  file_name: string | null;
}

export interface ReviewLabels {
  sample: string;
  sampleHint: string;
  empty: string;
  emptyHint: string;
  why: string;
  matched: string;
  score: string;
  accept: string;
  reject: string;
  choose: string;
  undo: string;
  keys: string;
  bundled: string;
  bundledHint: string;
  saved: string;
  undone: string;
  row: string;
  file: string;
  noCandidates: string;
  selectLine: string;
  acceptSelected: string;
  selected: string;
  error: string;
  listLabel: string;
}

export function ReviewQueue({
  initial,
  labels,
  locale,
}: {
  initial: QueueItem[];
  labels: ReviewLabels;
  locale: string;
}) {
  const [lines, setLines] = useState(initial);
  const [active, setActive] = useState(0);
  const [history, setHistory] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLFieldSetElement>(null);
  // After a line leaves (decided) or returns (undo), keep keyboard focus inside the list.
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    if (lines.length === 0) return;
    const index = Math.min(active, lines.length - 1);
    setActive(index);
    listRef.current?.querySelectorAll<HTMLElement>("[data-line]")[index]?.focus();
  }, [lines.length, active]);
  const money = new Intl.NumberFormat(
    locale === "kk" ? "kk-KZ" : locale === "ru" ? "ru-RU" : "en-GB",
    {
      maximumFractionDigits: 2,
    },
  );

  const focusLine = (index: number) => {
    const next = Math.max(0, Math.min(index, lines.length - 1));
    setActive(next);
    listRef.current?.querySelectorAll<HTMLElement>("[data-line]")[next]?.focus();
  };

  const decide = async (line: QueueItem, action: "accept" | "choose" | "reject", code?: string) => {
    if (busy) return;
    setBusy(true);
    const result = await reviewLine(line.id, action, code);
    setBusy(false);
    if (!result.ok) {
      setStatus(labels.error);
      return;
    }
    setHistory((h) => [line, ...h].slice(0, 20));
    refocus.current = true;
    setLines((ls) => ls.filter((l) => l.id !== line.id));
    setSelected((s) => {
      const next = new Set(s);
      next.delete(line.id);
      return next;
    });
    setStatus(labels.saved);
  };

  const undo = async () => {
    const [last, ...rest] = history;
    if (!last || busy) return;
    setBusy(true);
    const result = await reviewLine(last.id, "undo");
    setBusy(false);
    if (!result.ok) {
      setStatus(labels.error);
      return;
    }
    setHistory(rest);
    refocus.current = true;
    setActive(0);
    setLines((ls) => [last, ...ls]);
    setStatus(labels.undone);
  };

  const acceptSelected = async () => {
    for (const line of lines.filter((l) => selected.has(l.id) && l.match_candidates.length)) {
      await decide(line, "accept");
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLFieldSetElement>) => {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
    const line = lines[active];
    const key = e.key.toLowerCase();
    if (key === "j" || e.key === "ArrowDown") focusLine(active + 1);
    else if (key === "k" || e.key === "ArrowUp") focusLine(active - 1);
    else if (key === "u") void undo();
    else if (line && key === "a" && line.match_candidates.length) void decide(line, "accept");
    else if (line && key === "r") void decide(line, "reject");
    else if (line && /^[1-5]$/.test(key)) {
      const c = line.match_candidates[Number(key) - 1];
      if (c) void decide(line, "choose", c.code);
    } else return;
    e.preventDefault();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="gold" title={labels.sampleHint}>
          {labels.sample}
        </Badge>
        <span className="text-xs text-muted">{labels.sampleHint}</span>
      </div>
      <p id="review-keys" className="text-xs text-muted">
        {labels.keys}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void undo()}
          disabled={!history.length || busy}
        >
          {labels.undo}
        </Button>
        {selected.size > 0 && (
          <Button size="sm" onClick={() => void acceptSelected()} disabled={busy}>
            {labels.acceptSelected} ({selected.size} {labels.selected})
          </Button>
        )}
      </div>
      <p role="status" aria-live="polite" className="sr-only" data-testid="review-status">
        {status}
      </p>
      {lines.length === 0 ? (
        <EmptyState title={labels.empty} message={labels.emptyHint} />
      ) : (
        <fieldset
          ref={listRef}
          onKeyDown={onKeyDown}
          aria-describedby="review-keys"
          className="space-y-3 border-0 p-0"
        >
          <legend className="sr-only">{labels.listLabel}</legend>
          {lines.map((line, i) => (
            <article
              key={line.id}
              data-line
              data-testid="review-line"
              tabIndex={i === active ? 0 : -1}
              onFocus={() => setActive(i)}
              aria-label={line.item_text ?? ""}
              className={`rounded-[var(--qs-card-radius)] border bg-surface p-4 outline-none focus-visible:outline-2 focus-visible:outline-[var(--qs-focus)] ${
                i === active ? "border-[var(--qs-focus)]" : "border-line"
              }`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`${labels.selectLine}: ${line.item_text ?? ""}`}
                  checked={selected.has(line.id)}
                  onChange={(e) =>
                    setSelected((s) => {
                      const next = new Set(s);
                      if (e.target.checked) next.add(line.id);
                      else next.delete(line.id);
                      return next;
                    })
                  }
                  className="mt-1 size-5 accent-[var(--qs-accent-strong)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-base text-ink">{line.item_text}</p>
                  <p className="mt-1 text-xs text-muted">
                    {labels.file}: {line.file_name} · {labels.row} {line.source_row}
                    {line.supplier_text ? ` · ${line.supplier_text}` : ""}
                    {line.unit_price != null
                      ? ` · ${money.format(line.unit_price)} ${line.currency ?? ""}`
                      : ""}
                  </p>
                  {line.match_status === "bundled" && (
                    <p className="mt-2 text-sm text-ink">
                      <Badge variant="risk">{labels.bundled}</Badge>{" "}
                      <span className="text-muted">{labels.bundledHint}</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {line.match_candidates.length > 0 && (
                    <Button size="sm" onClick={() => void decide(line, "accept")} disabled={busy}>
                      {labels.accept}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void decide(line, "reject")}
                    disabled={busy}
                  >
                    {labels.reject}
                  </Button>
                </div>
              </div>
              {line.match_candidates.length === 0 ? (
                <p className="mt-3 text-sm text-muted">{labels.noCandidates}</p>
              ) : (
                <ol className="mt-3 space-y-2" aria-label={labels.why}>
                  {line.match_candidates.map((c, k) => (
                    <li key={c.code} className="flex flex-wrap items-center gap-2 text-sm">
                      <kbd className="inline-flex size-6 items-center justify-center rounded border border-line text-xs text-muted">
                        {k + 1}
                      </kbd>
                      <span className="text-ink">{c.name}</span>
                      <span className="font-mono text-xs text-muted">{c.code}</span>
                      <Badge variant={c.score >= 70 ? "ok" : "neutral"}>
                        {labels.score} {Math.round(c.score)}%
                      </Badge>
                      {c.matched.length > 0 && (
                        <span className="text-xs text-muted">
                          {labels.matched}: {c.matched.join(", ")}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void decide(line, "choose", c.code)}
                        disabled={busy}
                        aria-label={`${labels.choose}: ${c.name}`}
                      >
                        {labels.choose}
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </fieldset>
      )}
    </div>
  );
}
