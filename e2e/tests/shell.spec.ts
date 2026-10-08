import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectNoAxeViolations(page: import("@playwright/test").Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(violations).toEqual([]);
}

test("header exposes the global controls", async ({ page }, testInfo) => {
  await page.goto("/en");
  await expect(page.getByRole("button", { name: /^Organization/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Open notifications" })).toBeVisible();
  if (testInfo.project.name !== "phone") {
    // On phones these live in Settings (reachable from the Menu) to keep the header usable.
    await expect(page.getByRole("button", { name: "Appearance" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Language" })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
});

test("notification center shows its empty state", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: "Open notifications" }).click();
  await expect(page.getByText("No notifications")).toBeVisible();
  await expect(page.getByText("Alerts and mentions will appear here.")).toBeVisible();
});

test("language switcher keeps the current path and swaps the locale", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "phone",
    "header menus are desktop/tablet; phone uses Settings",
  );
  await page.goto("/en/settings");
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "Русский" }).click();
  await expect(page).toHaveURL(/\/ru\/settings$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
});

test("theme switcher applies dark mode", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "phone",
    "header menus are desktop/tablet; phone uses Settings",
  );
  await page.goto("/en");
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("reduce transparency persists across reloads", async ({ page, context }, testInfo) => {
  test.skip(
    testInfo.project.name === "phone",
    "header menus are desktop/tablet; phone uses Settings",
  );
  await page.goto("/en");
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("menuitemcheckbox", { name: /Reduce transparency/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-transparency", "true");
  // Wait for the server action to persist the preference before reloading.
  await expect
    .poll(
      async () => (await context.cookies()).find((c) => c.name === "qs_reduce_transparency")?.value,
    )
    .toBe("1");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-transparency", "true");

  await context.clearCookies();
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-reduce-transparency", "true");
});

test("keyboard: the first Tab reaches the skip link and it moves focus to main", async ({
  page,
}) => {
  await page.goto("/en");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main/);
});

test("mobile menu opens, closes on Escape, and stays accessible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "phone layout only");
  await page.goto("/en");
  await page.getByRole("button", { name: "Menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog).toBeVisible();
  // Wait for the enter animation to settle before scanning (axe composites opacity mid-flight).
  await expect(dialog).toHaveCSS("opacity", "1");
  await expectNoAxeViolations(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("reduced motion: the shell stays usable and axe-clean", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en");
  await expectNoAxeViolations(page);
  if (testInfo.project.name === "phone") {
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  }
});

test("audit page renders a state and is axe-clean", async ({ page }) => {
  await page.goto("/en/audit");
  await expect(page.getByRole("heading", { name: "Audit log", level: 1 })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("settings page is axe-clean", async ({ page }) => {
  await page.goto("/en/settings");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("phone: settings page carries theme, transparency and language", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "phone layout only");
  await page.goto("/en");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/en\/settings$/);
  await page.getByRole("radio", { name: "Dark" }).check();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("checkbox", { name: /Reduce transparency/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-transparency", "true");
  await page.getByRole("link", { name: "Қазақша" }).click();
  await expect(page).toHaveURL(/\/kk\/settings$/);
  await expectNoAxeViolations(page);
});
