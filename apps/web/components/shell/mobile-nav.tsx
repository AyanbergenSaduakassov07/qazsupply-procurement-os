"use client";

import { animate, durations, useAnimeScope, useReducedMotion } from "@qazsupply/motion";
import { useEffect, useState } from "react";

import { CloseIcon, MenuIcon } from "./icons";
import { type NavLinkItem, NavLinks } from "./nav-links";

function MobilePanel({
  items,
  labels,
  onClose,
}: {
  items: NavLinkItem[];
  labels: { menu: string; close: string; notAvailable: string };
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const root = useAnimeScope<HTMLDivElement>(
    (self) => {
      if (!self) return;
      animate(self.root as Element, {
        opacity: [0, 1],
        translateY: reduced ? [0, 0] : [-8, 0],
        duration: reduced ? 0 : durations.complex,
        ease: reduced ? "linear" : "outQuad",
      });
    },
    [reduced],
  );

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label={labels.close}
        onClick={onClose}
        className="absolute inset-0 bg-[var(--qs-scrim-bg)]"
      />
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={labels.menu}
        className="relative m-3 rounded-[var(--qs-card-radius)] border border-line bg-surface p-3 shadow-[var(--qs-elevation-3)]"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="px-2 text-sm font-medium text-ink">{labels.menu}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="rounded-[var(--qs-radius-md)] p-2 text-muted hover:bg-surface-raised hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>
        <NavLinks
          items={items}
          notAvailable={labels.notAvailable}
          ariaLabel={labels.menu}
          onNavigate={onClose}
        />
      </div>
    </div>
  );
}

export function MobileNav({
  items,
  labels,
}: {
  items: NavLinkItem[];
  labels: { menu: string; close: string; notAvailable: string };
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label={labels.menu}
        className="rounded-[var(--qs-radius-md)] p-2 text-ink hover:bg-surface-raised"
      >
        <MenuIcon />
      </button>
      {open ? <MobilePanel items={items} labels={labels} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
