import { expect, test } from "@playwright/test";

/**
 * Visual baselines: viewports (projects) x light/dark x kk/ru/en for key screens.
 * Rendered only in the Playwright Linux image (scripts/e2e-visual.sh), identical to CI.
 */
test.skip(
  process.env.E2E_VISUAL !== "1",
  "baselines render only in the Linux image: run scripts/e2e-visual.sh",
);

const SCREENS = [
  { name: "sign-in", path: "sign-in", signedIn: false },
  { name: "overview", path: "", signedIn: true },
  // Uploads only: screening and dossier views add entries in whatever order the run visits.
  { name: "audit", path: "/audit?kind=file", signedIn: true },
  { name: "upload", path: "/spend", signedIn: true },
  // Seed: Org A's released report, seen by its client admin (narrative, chart, Ask switched off).
  { name: "report", path: "/spend/reports/40000000-0000-4000-a000-00000000000a", signedIn: true },
  // M4: seeded Org A suppliers (sample sources); the dossier builds itself on first visit.
  { name: "suppliers", path: "/suppliers", signedIn: true },
  { name: "dossier", path: "/suppliers/7a000000-0000-4000-a000-0000000000a1", signedIn: true },
] as const;

for (const screen of SCREENS) {
  test.describe(screen.name, () => {
    if (!screen.signedIn) test.use({ storageState: { cookies: [], origins: [] } });
    for (const theme of ["light", "dark"] as const) {
      for (const locale of ["kk", "ru", "en"] as const) {
        test(`${screen.name} ${locale} ${theme}`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
          if (screen.name === "suppliers") {
            // Verdicts appear once a dossier is built; build them all first so the list never
            // depends on which dossier test ran before it.
            for (const id of ["a1", "a2", "a3", "a4"]) {
              await page.goto(`/en/suppliers/7a000000-0000-4000-a000-0000000000${id}`);
            }
          }
          await page.goto(`/${locale}${screen.path ? `/${screen.path.replace(/^\//, "")}` : ""}`);
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          await page.waitForLoadState("networkidle");
          await expect(page).toHaveScreenshot(`${screen.name}-${locale}-${theme}.png`, {
            fullPage: true,
            animations: "disabled",
            // Timestamps and hashes change on every seed: mask them.
            mask: [page.locator("time"), page.locator("[data-volatile]")],
          });
        });
      }
    }
  });
}
