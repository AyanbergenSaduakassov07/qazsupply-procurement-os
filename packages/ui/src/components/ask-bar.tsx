"use client";

import { type FormEvent, useState } from "react";

import { cn } from "../lib/utils";

export interface AskBarProps {
  labels: { placeholder: string; submit: string; disabledReason: string; readOnly: string };
  disabled?: boolean;
  onSubmit?: (question: string) => void;
  className?: string;
}

/** The single global Ask entry: read-only, tenant-scoped, every number cited. */
export function AskBar({ labels, disabled = false, onSubmit, className }: AskBarProps) {
  const [question, setQuestion] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = question.trim();
    if (!value || disabled) return;
    onSubmit?.(value);
    setQuestion("");
  };

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-1", className)}>
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={disabled}
          aria-describedby="ask-bar-note"
          placeholder={labels.placeholder}
          className="h-11 min-w-0 flex-1 rounded-[var(--qs-radius-md)] border border-line-strong bg-[var(--qs-input-bg)] px-3 text-sm text-ink placeholder:text-muted disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled}
          className="h-11 rounded-[var(--qs-btn-radius)] bg-accent-strong px-4 text-sm font-medium text-on-accent disabled:opacity-60"
        >
          {labels.submit}
        </button>
      </div>
      <p id="ask-bar-note" className="text-xs text-muted">
        {disabled ? labels.disabledReason : labels.readOnly}
      </p>
    </form>
  );
}
