"use client";

import { Badge } from "@qazsupply/ui/components/badge";
import { cn } from "@qazsupply/ui/lib/utils";
import { usePathname } from "next/navigation";

export interface NavLinkItem {
  key: string;
  href: string;
  label: string;
  disabled?: boolean;
}

export function NavLinks({
  items,
  notAvailable,
  ariaLabel,
  onNavigate,
}: {
  items: NavLinkItem[];
  notAvailable: string;
  ariaLabel: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={ariaLabel} className="flex flex-col gap-1">
      {items.map((item) => {
        if (item.disabled) {
          return (
            <span
              key={item.key}
              aria-disabled="true"
              className="flex items-center justify-between gap-2 rounded-[var(--qs-radius-md)] px-3 py-2 text-sm text-muted"
            >
              <span>{item.label}</span>
              <Badge variant="neutral">{notAvailable}</Badge>
            </span>
          );
        }
        const active = pathname === item.href;
        return (
          <a
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "rounded-[var(--qs-radius-md)] px-3 py-2 text-sm",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)]",
              active
                ? "bg-[var(--qs-nav-active-bg)] font-medium text-ink"
                : "text-muted hover:bg-surface-raised hover:text-ink",
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
