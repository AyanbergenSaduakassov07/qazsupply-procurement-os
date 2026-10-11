import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";

/**
 * M3 review gate through the UI: upload -> analysis -> review -> release -> client view.
 * Runs in Org B on the desktop project only: the journey mutates one shared report queue, so
 * parallel viewports would race each other.
 */

const ITEMS = [
  "Подшипник шариковый 6205",
  "Перчатки нитриловые",
  "Масло моторное 15W-40",
  "Болт М12",
  "Цемент М400",
  "Канат стальной",
];
const SUPPLIERS = [
  ["ТОО Альфа", "100140011111"],
  ["ТОО Бета", "100140022222"],
  ["ТОО Гамма", "100140033333"],
];

/** Three suppliers, three orders per item; Альфа is 35% dearer on every second item. */
function spendCsv(): Buffer {
  const rows = ["Наименование;Количество;Ед. изм.;Цена;Дата;Поставщик;БИН"];
  ITEMS.forEach((item, i) => {
    const base = 2_000 + i * 3_100;
    SUPPLIERS.forEach(([name, bin], s) => {
      for (let month = 1; month <= 3; month++) {
        const markup = i % 2 === 0 && s === 0 ? 1.35 : 1 + ((s + month) % 3) * 0.01;
        const price = (base * markup).toFixed(2).replace(".", ",");
        rows.push(
          `${item};${2 + month};шт;${price};${String(5 + s * 3).padStart(2, "0")}.0${month}.2026;${name};${bin}`,
        );
      }
    });
  });
  rows.push(`#${Date.now()}-${Math.random()}`);
  return Buffer.from(`${rows.join("\n")}\n`);
}

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(violations).toEqual([]);
}

async function as(browser: Browser, user: string): Promise<Page> {
  const context = await browser.newContext({ storageState: `.auth/${user}.json` });
  return context.newPage();
}

test("a report reaches the client only after review and release", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one project owns the shared review queue");
  test.setTimeout(120_000);

  const client = await as(browser, "clientAdminB");
  await client.goto("/en/spend");
  await client.getByTestId("upload-input").setInputFiles({
    name: "review-journey.csv",
    mimeType: "text/csv",
    buffer: spendCsv(),
  });
  await client.getByRole("button", { name: "Import rows" }).click();
  await expect(client.getByTestId("import-result")).toContainText("Imported");

  const reviewer = await as(browser, "reviewer");
  await reviewer.goto("/en/spend/reports");
  await reviewer.getByRole("button", { name: "Run analysis" }).click();
  // The analysis runs synchronously; on a cold server it can take longer than the default wait.
  await expect(reviewer).toHaveURL(/\/en\/spend\/reports\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const reportUrl = new URL(reviewer.url()).pathname;
  await expect(reviewer.getByTestId("report-status")).toHaveText("Draft");

  // Draft: the client gets "not found", not a hint that the report exists.
  await client.goto(reportUrl);
  await expect(client.getByRole("heading", { level: 1 })).not.toHaveText(/Spend X-ray/);

  await reviewer.getByRole("button", { name: "Submit for review" }).click();
  await expect(reviewer.getByTestId("report-status")).toHaveText("In review");
  await expect(reviewer.getByTestId("sla")).toContainText("In review for");
  await expect(reviewer.getByRole("button", { name: "Approve report" })).toBeDisabled();
  await axe(reviewer);

  // Keyboard-first decisions: R + note rejects the last finding, A keeps the rest.
  const findings = reviewer.getByTestId("console-finding");
  const total = await findings.count();
  expect(total).toBeGreaterThanOrEqual(3);
  await findings.last().focus();
  await reviewer.keyboard.press("r");
  await reviewer.getByLabel(/^Note/).fill("One-off emergency order, agreed with the buyer");
  await reviewer.getByRole("button", { name: "Save decision" }).click();
  await expect(findings.last().getByTestId("finding-decision")).toHaveText("Rejected");
  for (let i = 0; i < total - 1; i++) {
    await findings.nth(i).focus();
    await reviewer.keyboard.press("a");
    await expect(findings.nth(i).getByTestId("finding-decision")).toHaveText("Approved");
  }
  await expect(reviewer.getByTestId("decided")).toHaveText(`${total} of ${total} findings decided`);
  await expect(reviewer.getByTestId("review-history").locator("li")).toHaveCount(total);

  await reviewer.getByRole("button", { name: "Approve report" }).click();
  await reviewer.getByRole("button", { name: "Save decision" }).click();
  await expect(reviewer.getByTestId("report-status")).toHaveText("Approved");

  // Approved but not released: still invisible to the client.
  await client.goto(reportUrl);
  await expect(client.getByTestId("findings")).toHaveCount(0);

  await reviewer.getByRole("button", { name: "Release to client" }).click();
  await reviewer.getByTestId("release-confirm").click();
  await expect(reviewer.getByTestId("report-status")).toHaveText("Released");
  await expect(reviewer.getByRole("button", { name: "Save decision" })).toHaveCount(0);

  // Released: the client sees the kept findings only.
  await client.goto(reportUrl);
  await expect(client.getByTestId("findings").locator("li")).toHaveCount(total - 1);
  await expect(client.getByText("One-off emergency order")).toHaveCount(0);
  await axe(client);
});
