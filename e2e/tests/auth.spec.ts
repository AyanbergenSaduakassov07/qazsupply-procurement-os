import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import fixture from "../fixtures/users.json" with { type: "json" };

const ORG_B = fixture.orgs.B;

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(violations).toEqual([]);
}

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("app pages redirect to sign-in", async ({ page }) => {
    for (const path of ["/en", "/en/audit", "/kk/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/(en|kk)\/sign-in$/);
    }
  });

  for (const locale of ["kk", "ru", "en"] as const) {
    test(`sign-in page is axe-clean in ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/sign-in`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expectNoAxeViolations(page);
    });
  }

  test("wrong password shows a plain-language error, not a crash", async ({ page }) => {
    await page.goto("/ru/sign-in");
    await page.getByLabel("Электронная почта").fill(fixture.users.clientAdminA);
    await page.getByLabel("Пароль").fill("wrong-password");
    await page.getByRole("button", { name: "Войти" }).click();
    // Next's route announcer is also role=alert: match ours by text.
    await expect(
      page.getByRole("alert").filter({ hasText: "Неверный адрес почты или пароль" }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("keyboard only: sign in, switch nothing, reach the audit log", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email")).toBeFocused();
    await page.keyboard.type(fixture.users.clientAdminA);
    await page.keyboard.press("Tab");
    await page.keyboard.type(fixture.password);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en$/);
    // Screening and dossier views add many entries; the filter keeps uploads reachable.
    await page.goto("/en/audit?kind=file");
    await expect(page.getByText("file.uploaded").first()).toBeVisible();
  });
});

test.describe("tenant isolation through the UI (client_admin of Org A)", () => {
  test("only Org A is offered and shown", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByTestId("current-org")).toHaveText("Demo Mining A");
    await page.getByRole("button", { name: /^Organization/ }).click();
    await expect(page.getByRole("menuitemradio")).toHaveCount(1);
    await expect(page.getByText("Demo Logistics B")).toHaveCount(0);
  });

  test("a forged org cookie for Org B is ignored", async ({ page, context, baseURL }) => {
    await context.addCookies([
      { name: "qs_org", value: ORG_B, url: baseURL ?? "http://localhost:3000" },
    ]);
    for (const path of ["/en", "/en/audit"]) {
      await page.goto(path);
      await expect(page.getByText("Demo Logistics B")).toHaveCount(0);
      await expect(page.getByText("b_secret_prices")).toHaveCount(0);
    }
    await expect(page.getByTestId("current-org")).toHaveCount(0); // audit page has no org card
    await page.goto("/en");
    await expect(page.getByTestId("current-org")).toHaveText("Demo Mining A");
  });

  test("audit log shows Org A entries with a verified chain", async ({ page }) => {
    await page.goto("/en/audit");
    await page
      .getByRole("navigation", { name: "Filter by action" })
      .getByRole("link", { name: "Uploads" })
      .click();
    await expect(page).toHaveURL(/kind=file/);
    await expect(page.getByText("file.uploaded").first()).toBeVisible();
    await expect(page.getByText(/chain.*(intact|verified)/i)).toBeVisible();
  });

  test("the API refuses Org B with this user's own session", async ({ page, request }) => {
    const state = await page.context().storageState();
    const token = state.cookies.find((c) => c.name === "qs_access_token")?.value;
    expect(token).toBeTruthy();
    const r = await request.get(`http://localhost:8000/orgs/${ORG_B}/reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.status()).toBe(404);
  });

  test("sign out ends the session", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/en\/sign-in$/);
    await page.goto("/en");
    await expect(page).toHaveURL(/\/en\/sign-in$/);
  });
});

test.describe("roles", () => {
  test.describe("client_user", () => {
    test.use({ storageState: ".auth/clientUserA.json" });
    test("sees only the released report and no audit navigation", async ({ page }) => {
      await page.goto("/en");
      await expect(page.getByTestId("reports").getByRole("listitem")).toHaveCount(1);
      await expect(page.getByTestId("reports")).toContainText("Released");
      await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);
    });
  });

  test.describe("reviewer", () => {
    test.use({ storageState: ".auth/reviewer.json" });
    test("switches orgs and sees draft and released reports in Org A", async ({ page }) => {
      const pick = async (name: string) => {
        await page.getByRole("button", { name: /^Organization/ }).click();
        await page.getByRole("menuitemradio", { name: new RegExp(name) }).click();
        await expect(page.getByTestId("current-org")).toHaveText(name);
      };
      await page.goto("/en");
      await pick("Demo Mining A");
      await expect(page.getByTestId("reports").getByRole("listitem")).toHaveCount(2);
      await pick("Demo Logistics B");
      await page.reload(); // the choice persists (httpOnly cookie), membership re-checked server-side
      await expect(page.getByTestId("current-org")).toHaveText("Demo Logistics B");
    });
  });
});
