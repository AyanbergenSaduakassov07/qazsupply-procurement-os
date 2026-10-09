"use client";

import { AppToaster } from "@qazsupply/ui/components/toast";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

export function Providers({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      nonce={nonce}
    >
      {children}
      <AppToaster />
    </ThemeProvider>
  );
}
