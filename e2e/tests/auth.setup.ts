import { expect, test as setup } from "@playwright/test";

import fixture from "../fixtures/users.json" with { type: "json" };

/** Sign in through the real UI once per user and save the session for other tests. */
for (const user of [
  "clientAdminA",
  "clientUserA",
  "clientAdminB",
  "reviewer",
  "supplier",
] as const) {
  setup(`sign in as ${user}`, async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(fixture.users[user]);
    await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await page.context().storageState({ path: `.auth/${user}.json` });
  });
}
