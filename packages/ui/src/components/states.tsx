import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export interface StateProps {
  title: string;
  message: string;
  action?: ReactNode;
  className?: string;
}

/** Designed empty state. Every feature gets one; never a bare blank panel. */
export function EmptyState({ title, message, action, className }: StateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center gap-2 rounded-[var(--qs-card-radius)] border border-dashed border-line bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-md text-sm text-muted">{message}</p>
      {action}
    </div>
  );
}

export function LoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-3 px-2 py-6 text-sm text-muted", className)}
    >
      <span
        aria-hidden="true"
        className="size-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-[var(--qs-accent)] motion-reduce:animate-none"
      />
      <span>{label}</span>
    </div>
  );
}

/** Error states say cause + fix and never blame the user (brand voice). */
export function ErrorState({ title, message, action, className }: StateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-2 rounded-[var(--qs-card-radius)] border border-risk/40 bg-surface px-5 py-4",
        className,
      )}
    >
      <p className="text-sm font-medium text-risk">{title}</p>
      <p className="text-sm text-muted">{message}</p>
      {action}
    </div>
  );
}
