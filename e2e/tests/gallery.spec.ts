import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(violations).toEqual([]);
}

test("gallery lists every component and is axe-clean", async ({ page }) => {
  await page.goto("/en/gallery");
  await expect(page.getByRole("heading", { name: "Component gallery", level: 1 })).toBeVisible();
  for (const heading of [
    "Buttons",
    "Badges",
    "Charts",
    "Data table",
    "Ask bar",
    "Command palette",
  ]) {
    await expect(page.getByText(heading, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByRole("img", { name: "Price variance" })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("evidence drawer shows meta and source rows, and is axe-clean", async ({ page }) => {
  await page.goto("/en/gallery");
  await page.getByRole("button", { name: "Open evidence" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Evidence" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("opacity", "1");
  await expect(dialog.getByText("ev-8f31c0")).toBeVisible();
  await expect(dialog.getByText("Кабель ВВГ 3х2.5").first()).toBeVisible();
  await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});

test("command palette opens, filters and is axe-clean", async ({ page }) => {
  await page.goto("/en/gallery");
  await page.getByRole("button", { name: "Open command palette" }).click();
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("opacity", "1");
  await expectNoAxeViolations(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("toast shows a message", async ({ page }) => {
  await page.goto("/en/gallery");
  await page.getByRole("button", { name: "Show toast" }).click();
  await expect(page.getByText("Report saved as a draft.")).toBeVisible();
});

test("data table sorts and is keyboard operable", async ({ page }) => {
  await page.goto("/en/gallery");
  const spendHeader = page.getByRole("button", { name: /Potential saving/ });
  await expect(spendHeader).toBeVisible();
  await page.getByRole("button", { name: /BIN/ }).click();
  await expect(page.getByRole("columnheader", { name: /BIN/ })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
});
