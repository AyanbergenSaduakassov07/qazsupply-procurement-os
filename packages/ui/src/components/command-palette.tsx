"use client";

import { Command } from "cmdk";

export interface CommandPaletteItem {
  id: string;
  label: string;
  group: string;
  keywords?: string;
  hint?: string;
  disabled?: boolean;
  onSelect?: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  items,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandPaletteItem[];
  labels: { title: string; placeholder: string; empty: string };
}) {
  const groups = [...new Set(items.map((item) => item.group))];

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={labels.title}
      overlayClassName="fixed inset-0 z-50 bg-[var(--qs-scrim-bg)]"
      contentClassName="fixed left-1/2 top-[15%] z-50 w-[min(92vw,560px)] -translate-x-1/2 overflow-hidden rounded-[var(--qs-card-radius)] border border-line bg-surface shadow-[var(--qs-elevation-3)]"
      shouldFilter
    >
      <Command.Input
        placeholder={labels.placeholder}
        className="h-12 w-full border-line border-b bg-transparent px-4 text-sm text-ink outline-none"
      />
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
          {labels.empty}
        </Command.Empty>
        {groups.map((group) => (
          <Command.Group
            key={group}
            heading={group}
            className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted"
          >
            {items
              .filter((item) => item.group === group)
              .map((item) => (
                <Command.Item
                  key={item.id}
                  value={`${item.label} ${item.keywords ?? ""}`}
                  disabled={item.disabled}
                  onSelect={() => {
                    item.onSelect?.();
                    onOpenChange(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-[var(--qs-radius-sm)] px-2 py-2 text-sm text-ink data-[selected=true]:bg-surface-raised data-[disabled=true]:text-muted"
                >
                  <span className="flex-1">{item.label}</span>
                  {item.hint ? <span className="text-xs text-muted">{item.hint}</span> : null}
                </Command.Item>
              ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
