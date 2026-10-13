import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";

/**
 * M5 Procurement OS in Org A: template -> ТЗ check -> draft -> approval -> "I sent it" ->
 * supplier portal offer + emailed offer with confirmation note -> comparison -> close ->
 * decision memo + PDF. Each run creates its own RFQ, so viewports run in parallel safely.
 */
async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(violations).toEqual([]);
}

async function as(browser: Browser, user: string): Promise<Page> {
  const ctx = await browser.newContext({
    storageState: `.auth/${user}.json`,
    reducedMotion: "reduce",
  });
  return ctx.newPage();
}

test("an RFQ from template to recorded decision, with people at every gate", async ({
  browser,
}) => {
  test.setTimeout(120_000); // one long journey across four people
  const buyer = await as(browser, "clientUserA");
  const title = `Цемент e2e ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await buyer.goto("/en/rfqs/new");
  await buyer.getByRole("button", { name: "Cement" }).click();
  await buyer.getByLabel("Title").fill(title);
  await buyer.getByRole("button", { name: "Check specification" }).click();
  await expect(buyer.getByTestId("spec-findings")).toBeVisible();
  await axe(buyer);
  await buyer.getByRole("button", { name: "Create draft" }).click();
  await expect(buyer.getByTestId("rfq-status")).toHaveText("Draft");
  const url = buyer.url();
  await expect(buyer.getByTestId("approval")).toContainText("Only a client admin");

  // Invites while drafting; nothing can be marked sent before approval.
  const invites = buyer.getByTestId("invites");
  await invites.getByRole("combobox").first().selectOption({ label: "ТОО «Бета»" });
  await invites.getByRole("button", { name: "Invite supplier" }).click();
  await expect(invites.getByText("Not sent")).toHaveCount(1);
  await invites.getByRole("combobox").first().selectOption({ label: "ТОО «Альфа»" });
  await invites.getByLabel("How you will send it").selectOption("portal");
  await invites.getByLabel("Supplier user's email (portal)").fill("supplier@qazsupply.test");
  await invites.getByRole("button", { name: "Invite supplier" }).click();
  await expect(invites.getByText("Not sent")).toHaveCount(2);
  await expect(invites.getByRole("button", { name: "I sent it" })).toHaveCount(0);

  const admin = await as(browser, "clientAdminA");
  await admin.goto(url);
  await admin.getByTestId("approval").getByRole("button", { name: "Approve this version" }).click();
  await expect(admin.getByTestId("rfq-status")).toHaveText("Approved");
  for (let i = 0; i < 2; i++) {
    await admin.getByTestId("invites").getByRole("button", { name: "I sent it" }).first().click();
    await expect(
      admin.getByTestId("invites").getByRole("button", { name: "I sent it" }),
    ).toHaveCount(1 - i);
  }
  await expect(admin.getByTestId("rfq-status")).toHaveText("Sent");

  // The supplier answers through the portal and never sees the other supplier.
  const supplier = await as(browser, "supplier");
  await supplier.goto(url);
  const form = supplier.getByTestId("portal-offer-form");
  await form.getByLabel(/Unit price/).fill("31000");
  await form.getByLabel("Lead time, days").fill("21");
  await form.getByLabel("Payment, days").fill("30");
  await axe(supplier);
  await form.getByRole("button", { name: "Submit offer" }).click();
  await expect(supplier.getByTestId("offers").getByTestId("offer-state")).toHaveText(
    "Numbers confirmed",
  );
  await expect(supplier.getByText("ТОО «Бета»")).toHaveCount(0);

  // The buyer enters the emailed offer; it counts only once confirmed with a note.
  await buyer.goto(url);
  await buyer.getByText("Enter an offer received by email or phone").click();
  const bform = buyer.getByTestId("buyer-offer-form");
  await bform.getByLabel(/Unit price/).fill("30500");
  await bform.getByLabel("Lead time, days").fill("35");
  await bform.getByRole("button", { name: "Submit offer" }).click();
  await expect(buyer.getByTestId("offer-state").filter({ hasText: "not confirmed" })).toHaveCount(
    1,
  );
  await buyer.getByLabel("How the supplier confirmed (required)").fill("Signed PDF by email");
  await buyer.getByRole("button", { name: "Confirm numbers" }).click();
  await expect(buyer.getByTestId("offer-state").filter({ hasText: "not confirmed" })).toHaveCount(
    0,
  );

  await buyer.getByRole("link", { name: "Compare offers" }).click();
  await expect(buyer.getByRole("heading", { name: "Offer comparison" })).toBeVisible();
  await expect(
    buyer.getByText("Highest score", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(buyer.getByTestId("sensitivity")).toBeVisible();
  await axe(buyer);

  await buyer.goto(url);
  await buyer.getByRole("button", { name: "Stop collecting offers" }).click();
  await expect(buyer.getByTestId("rfq-status")).toHaveText("Closed");
  await admin.goto(url);
  await admin
    .getByLabel("Reason (at least 10 characters)")
    .fill("Lower total price; lead time acceptable for Q4.");
  await admin.getByTestId("closing").getByRole("button", { name: "Record decision" }).click();
  await expect(admin.getByTestId("rfq-status")).toHaveText("Decided");
  await expect(admin.getByTestId("memo")).toContainText("Lower total price");
  const download = admin.waitForEvent("download");
  await admin.getByRole("link", { name: "Download PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/^qazsupply-decision-.*\.pdf$/);
  await axe(admin);
});

test.describe("catalogue", () => {
  test.use({ storageState: ".auth/clientUserA.json" });

  test("search forgives Kazakh letters and explains empty results", async ({ page }) => {
    const tag = Math.random().toString(36).slice(2, 7);
    await page.goto("/en/catalogue");
    await page.getByLabel("Item").fill(`Қолғап нитрилді ${tag}`);
    await page
      .getByLabel("Attributes (one per line, name: value)")
      .fill("material: nitrile\nsize: L");
    await page.getByRole("button", { name: "Add catalogue item" }).click();
    await expect(page.getByLabel("Item")).toHaveValue(""); // saved: the form resets
    await page.goto(`/en/catalogue?q=${encodeURIComponent(`колгап нитрилди ${tag}`)}`);
    await expect(page.getByTestId("catalogue-results")).toContainText(`Қолғап нитрилді ${tag}`);
    await page.goto(`/en/catalogue?q=${encodeURIComponent(`колгап ${tag}`)}&attr=size:XXL`);
    await expect(page.getByTestId("catalogue-empty")).toContainText("none match the filter");
    await axe(page);
  });
});
