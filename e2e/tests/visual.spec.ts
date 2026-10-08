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
  { name: "audit", path: "/audit", signedIn: true },
] as const;

for (const screen of SCREENS) {
  test.describe(screen.name, () => {
    if (!screen.signedIn) test.use({ storageState: { cookies: [], origins: [] } });
    for (const theme of ["light", "dark"] as const) {
      for (const locale of ["kk", "ru", "en"] as const) {
        test(`${screen.name} ${locale} ${theme}`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
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
