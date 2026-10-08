import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-[var(--qs-btn-radius)]",
    "px-4 text-sm font-medium whitespace-nowrap",
    "transition-[transform,opacity,background-color] duration-200 ease-[var(--qs-ease-standard)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)]",
    "disabled:pointer-events-none disabled:opacity-60",
    "active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
  ],
  {
    variants: {
      variant: {
        primary: "bg-accent-strong text-on-accent hover:opacity-90",
        secondary: "border border-line bg-surface text-ink hover:bg-surface-raised",
        ghost: "text-ink hover:bg-surface-raised",
        danger: "bg-risk text-white hover:opacity-90",
      },
      size: {
        md: "h-11",
        sm: "h-9 min-h-9 px-3",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
