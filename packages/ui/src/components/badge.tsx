import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "../lib/utils";

/**
 * Status badge. Colour is never the only signal: the badge always carries text
 * (WCAG 1.4.1) and pairs with an icon where one is meaningful.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-surface-raised text-muted",
        risk: "border border-risk/40 text-risk",
        ok: "border border-ok/40 text-ok",
        gold: "border border-gold/40 text-gold",
        accent: "border border-accent/40 text-link",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
