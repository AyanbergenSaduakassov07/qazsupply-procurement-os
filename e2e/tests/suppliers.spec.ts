import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/**
 * M4 Supplier 360 journeys in Org A on the seeded sample suppliers (infra/supabase/seed.sql):
 * list -> dossier (verdict, tabs, ownership graph + table) -> screening decision -> outage state.
 */
const ALFA = "7a000000-0000-4000-a000-0000000000a1";
const GAMMA = "7a000000-0000-4000-a000-0000000000a2";
const DOWN = "7a000000-0000-4000-a000-0000000000a3";

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(violations).toEqual([]);
}

test.describe("client admin of Org A", () => {
  test.use({ storageState: ".auth/clientAdminA.json" });

  test("dossier: verdict with reasons, keyboard tabs, ownership graph and table", async ({
    page,
  }) => {
    await page.goto(`/en/suppliers/${ALFA}`);
    const strip = page.getByTestId("verdict-strip");
    await expect(strip.getByTestId("verdict")).toBeVisible();
    await expect(page.getByTestId("top-reasons").locator("li").first()).toBeVisible();
    await expect(page.getByText("Sample data").first()).toBeVisible();
    await axe(page);

    const nodes = page.getByTestId("graph-node");
    await expect(nodes).toHaveCount(5);
    await nodes.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(nodes.nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("party-details")).toBeVisible();

    await page.getByLabel("Table").check();
    await expect(page.getByTestId("ownership-table").locator("tbody tr")).not.toHaveCount(0);

    const ownership = page.getByRole("tab", { name: "Ownership" });
    await ownership.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Registry" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("rnu")).toContainText("Not in the unreliable-supplier registry");
    await axe(page);
  });

  test("a namesake is dismissed with a reason, never blocking", async ({ page }) => {
    await page.goto(`/en/suppliers/${ALFA}`);
    await page.getByRole("tab", { name: "Screening" }).click();
    await expect(page.getByText("A match never blocks a supplier.")).toBeVisible();
    const hit = page.getByTestId("hit").filter({ hasText: "KIM, Viktor" }).first();
    await expect(hit).toContainText("Birth year: party 1968, list 1991");
    await hit.getByRole("button", { name: "Dismiss" }).click();
    await hit.getByLabel("Reason").selectOption("different_birth_year");
    await axe(page);
    await hit.getByRole("button", { name: "Save decision" }).click();
    await expect(hit.getByTestId("hit-state")).toContainText("Dismissed");
  });

  test("a 50+ party holding stays readable and keyboard reachable", async ({ page }) => {
    await page.goto(`/en/suppliers/${GAMMA}`);
    await expect(page.getByTestId("graph-node")).toHaveCount(50);
    await page.getByTestId("graph-node").first().focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("graph-node").nth(2)).toBeFocused();
  });

  test("a registry outage is shown, not hidden", async ({ page }) => {
    await page.goto(`/en/suppliers/${DOWN}`);
    await expect(page.getByTestId("degraded")).toContainText("not responding");
    await expect(page.getByText("No registry data yet")).toBeVisible();
    await axe(page);
  });

  test("the supplier list shows verdicts as words, not colour alone", async ({ page }) => {
    await page.goto(`/en/suppliers/${ALFA}`);
    await page.goto("/en/suppliers");
    const row = page.getByTestId("suppliers").getByRole("row", { name: /ТОО «Альфа»/ });
    await expect(row.getByTestId("verdict")).toHaveText(
      /Needs attention|High risk|Low risk|Not enough data/,
    );
    await axe(page);
  });
});

test.describe("client user of Org A", () => {
  test.use({ storageState: ".auth/clientUserA.json" });

  test("sees screening but cannot decide on a match", async ({ page }) => {
    await page.goto(`/en/suppliers/${ALFA}`);
    await page.getByRole("tab", { name: "Screening" }).click();
    await expect(page.getByTestId("hit").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm match" })).toHaveCount(0);
  });
});
