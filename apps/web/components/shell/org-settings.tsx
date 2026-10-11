"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { updateOrgSettings } from "../../app/ask-actions";

type Key = "ask_enabled" | "four_eyes";

export interface OrgSettingsLabels {
  ask: string;
  askHint: string;
  fourEyes: string;
  fourEyesHint: string;
  saved: string;
  adminOnly: string;
  error: string;
}

/** Organization switches. The database decides who may change what; the UI only mirrors it. */
export function OrgSettings({
  values,
  canEdit,
  labels,
}: {
  values: Record<Key, boolean>;
  canEdit: Record<Key, boolean>;
  labels: OrgSettingsLabels;
}) {
  const id = useId();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [current, setCurrent] = useState(values);

  const toggle = async (key: Key, value: boolean) => {
    setBusy(true);
    setCurrent((c) => ({ ...c, [key]: value })); // optimistic; reverted below on failure
    const result = await updateOrgSettings({ [key]: value });
    setBusy(false);
    if (!result.ok) setCurrent((c) => ({ ...c, [key]: !value }));
    setStatus(
      result.ok ? labels.saved : result.code === "admin_only" ? labels.adminOnly : labels.error,
    );
    if (result.ok) router.refresh();
  };

  const row = (key: Key, title: string, hint: string) => (
    <div className="flex items-start gap-3">
      <input
        id={`${id}-${key}`}
        type="checkbox"
        checked={current[key]}
        disabled={busy || !canEdit[key]}
        onChange={(e) => void toggle(key, e.target.checked)}
        aria-describedby={`${id}-${key}-hint`}
        className="mt-1 size-5 accent-[var(--qs-accent-strong)]"
        data-testid={`org-${key}`}
      />
      <div>
        <label htmlFor={`${id}-${key}`} className="text-sm font-medium text-ink">
          {title}
        </label>
        <p id={`${id}-${key}-hint`} className="text-sm text-muted">
          {hint}
          {canEdit[key] ? "" : ` ${labels.adminOnly}`}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {row("ask_enabled", labels.ask, labels.askHint)}
      {row("four_eyes", labels.fourEyes, labels.fourEyesHint)}
      <p role="status" className="text-sm text-muted" data-testid="org-settings-status">
        {status}
      </p>
    </div>
  );
}
