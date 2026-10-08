"use client";

import { Badge } from "@qazsupply/ui/components/badge";
import { AskIcon } from "./icons";

/**
 * The single global Ask entry. Disabled until the client has data to answer from;
 * the reason is exposed to assistive tech, not just on hover.
 */
export function AskEntry({
  labels,
}: {
  labels: { entry: string; disabled: string; notAvailable: string };
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-describedby="ask-disabled-reason"
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--qs-radius-md)] border border-line px-2.5 text-sm text-muted"
      >
        <AskIcon />
        <span>{labels.entry}</span>
      </button>
      <span id="ask-disabled-reason" className="sr-only">
        {labels.disabled}
      </span>
      <Badge variant="neutral" className="hidden sm:inline-flex">
        {labels.notAvailable}
      </Badge>
    </div>
  );
}
