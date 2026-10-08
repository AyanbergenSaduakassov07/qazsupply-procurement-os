"use client";

import type { ComponentProps } from "react";
import { Toaster, toast } from "sonner";

export { toast };

/** App-wide toaster, styled from design tokens. Mount once in the app shell. */
export function AppToaster(props: ComponentProps<typeof Toaster>) {
  return (
    <Toaster
      theme="system"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "rounded-[var(--qs-radius-md)] border border-line bg-surface text-ink shadow-[var(--qs-elevation-2)]",
          description: "text-muted",
          actionButton: "bg-accent-strong text-on-accent",
          cancelButton: "text-muted",
        },
      }}
      {...props}
    />
  );
}
