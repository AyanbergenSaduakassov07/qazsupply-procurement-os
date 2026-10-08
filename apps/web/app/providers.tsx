"use client";

import { AppToaster } from "@qazsupply/ui/components/toast";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem enableColorScheme>
      {children}
      <AppToaster />
    </ThemeProvider>
  );
}
