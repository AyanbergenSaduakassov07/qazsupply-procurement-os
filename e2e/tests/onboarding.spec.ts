import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/**
 * M4 onboarding: buyer invites from a dossier -> supplier fills details, uploads a document,
 * confirms and sends -> buyer approves (human check). Org A; each run creates its own case.
 */
const BETA = "7a000000-0000-4000-a000-0000000000a4";
const PDF = Buffer.from("%PDF-1.4\n% e2e sample\n");

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(violations).toEqual([]);
}

test("invite -> supplier completes on its own link -> buyer approves", async ({ browser }) => {
  const buyer = await browser.newContext({ storageState: ".auth/clientAdminA.json" });
  const b = await buyer.newPage();
  await b.goto(`/en/suppliers/${BETA}`);
  await b.getByLabel("Supplier user's email").fill("supplier@qazsupply.test");
  await b.getByRole("button", { name: "Create request" }).click();
  const done = b.getByTestId("invite-done");
  await expect(done).toContainText("/en/onboarding/");
  const link = (await done.textContent())?.match(/\/en\/onboarding\/[0-9a-f-]{36}/)?.[0];
  expect(link).toBeTruthy();

  const supplier = await browser.newContext({ storageState: ".auth/supplier.json" });
  const s = await supplier.newPage();
  await s.goto(link ?? "");
  await expect(s.getByRole("heading", { name: /Step 1 of 3/ })).toBeVisible();
  await axe(s);
  await s.getByLabel("Legal name").fill("ТОО «Бета»");
  await s.getByLabel("BIN").fill("210987654321");
  await s.getByLabel("Contact person").fill("Нұрлан");
  await s.getByLabel("Phone").fill("+7 701 000 00 00");
  await s.getByRole("button", { name: "Save and continue" }).click();
  await expect(s.getByRole("heading", { name: /Step 2 of 3/ })).toBeFocused();

  await s.getByTestId("doc-file").setInputFiles({
    name: "exe.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("MZ not a pdf"),
  });
  await s.getByRole("button", { name: "Upload document" }).click();
  await expect(s.getByText("This file is not a PDF, PNG or JPEG.")).toBeVisible();
  await s
    .getByTestId("doc-file")
    .setInputFiles({ name: "registration.pdf", mimeType: "application/pdf", buffer: PDF });
  await s.getByLabel("Document number").fill("R-42");
  await s.getByLabel("I checked: the number and date match the document").check();
  await s.getByRole("button", { name: "Upload document" }).click();
  await expect(s.getByTestId("documents")).toContainText("registration.pdf");
  await axe(s);
  await s.getByRole("button", { name: "Continue" }).click();
  await s.getByLabel("The details and documents are correct and belong to this company").check();
  await s.getByRole("button", { name: "Send for review" }).click();
  await expect(s.getByTestId("case-status")).toHaveText("Sent for review");

  await b.goto(link ?? "");
  await expect(b.getByTestId("case-status")).toHaveText("Sent for review");
  const download = b.waitForEvent("download");
  await b.getByRole("link", { name: "Download" }).click();
  expect((await download).suggestedFilename()).toBe("registration.pdf");
  await b.getByRole("button", { name: "Reject" }).click();
  await expect(b.getByText("Add a note for the supplier.")).toBeVisible();
  await b.getByLabel("Note to the supplier").fill("Registry matches the certificate");
  await b.getByRole("button", { name: "Approve" }).click();
  await expect(b.getByTestId("case-status")).toHaveText("Approved");
  await axe(b);

  await s.reload();
  await expect(s.getByTestId("case-status")).toHaveText("Approved");
  await buyer.close();
  await supplier.close();
});

test.describe("supplier role", () => {
  test.use({ storageState: ".auth/supplier.json" });

  test("sees only onboarding, not spend or dossiers", async ({ page }, testInfo) => {
    await page.goto("/en/onboarding");
    await expect(page.getByRole("heading", { name: "Supplier onboarding" })).toBeVisible();
    if (testInfo.project.name === "desktop") {
      // Tablet/phone keep the same nav behind the Menu button.
      const nav = page.getByRole("navigation", { name: "Primary navigation" });
      await expect(nav.getByRole("link", { name: "Onboarding" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Suppliers" })).toHaveCount(0);
    }
    const r = await page.goto("/en/suppliers/7a000000-0000-4000-a000-0000000000a1");
    expect(r?.status()).toBe(404);
  });
});
