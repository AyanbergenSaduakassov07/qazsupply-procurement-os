import AxeBuilder from "@axe-core/playwright";
import {
  type Browser,
  type BrowserContextOptions,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

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

async function as(
  browser: Browser,
  user: string,
  options: BrowserContextOptions = {},
): Promise<Page> {
  const context = await browser.newContext({ storageState: `.auth/${user}.json`, ...options });
  return context.newPage();
}

/** All text of a PDF, whitespace removed (Intl uses narrow no-break spaces in amounts). */
async function pdfText(bytes: Buffer): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(bytes) }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    text += content.items.map((item) => ("str" in item ? item.str : "")).join("");
  }
  return squash(text);
}

const squash = (text: string) => text.replace(/\s+/gu, "");

test("a report reaches the client only after review and release", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one project owns the shared review queue");
  test.setTimeout(120_000);

  // Reduced motion: the headline count-up must land instantly (and the figure is then stable).
  const client = await as(browser, "clientAdminB", { reducedMotion: "reduce" });
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

  // Approved but not released: still invisible to the client, on screen and as a PDF.
  await client.goto(reportUrl);
  await expect(client.getByTestId("findings")).toHaveCount(0);
  expect((await client.request.get(`${reportUrl}/pdf`)).status()).toBe(404);

  await reviewer.getByRole("button", { name: "Release to client" }).click();
  await reviewer.getByTestId("release-confirm").click();
  await expect(reviewer.getByTestId("report-status")).toHaveText("Released");
  await expect(reviewer.getByRole("button", { name: "Save decision" })).toHaveCount(0);

  // Released: the client sees the kept findings only, ranked, with the reviewer named.
  await client.goto(reportUrl);
  const shown = client.getByTestId("report-finding");
  await expect(shown).toHaveCount(total - 1);
  await expect(client.getByText("One-off emergency order")).toHaveCount(0);
  await expect(client.getByTestId("reviewed-by")).toContainText("Reviewed by Demo Reviewer");
  await axe(client);

  // Every number opens its evidence, with the person who reviewed it.
  await shown.first().getByTestId("finding-saving").click();
  const drawer = client.getByRole("dialog");
  await expect(drawer.getByTestId("evidence-reviewed-by")).toContainText("Demo Reviewer");
  await expect(drawer.getByRole("table")).toBeVisible();
  await client.keyboard.press("Escape");
  await client.getByTestId("report-headline").click();
  await expect(drawer.getByTestId("evidence-parts").locator("li")).toHaveCount(total - 1);
  await client.keyboard.press("Escape");

  // PDF figures equal screen figures exactly (same model, same formatter).
  const headline = squash(await client.getByTestId("report-headline").innerText()).replace(
    "Potentialsavings",
    "",
  );
  const savings = (await client.getByTestId("finding-saving").allInnerTexts()).map(squash);
  const response = await client.request.get(`${reportUrl}/pdf`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  const pdf = await pdfText(await response.body());
  expect(pdf).toContain(headline);
  for (const saving of savings) expect(pdf).toContain(saving);
  expect(pdf).toContain(reportUrl.split("/").pop() ?? "missing-id"); // footer: report id
  expect(pdf).toContain("DemoReviewer");

  // Three languages, each with its own number and date formats.
  for (const locale of ["kk", "ru"]) {
    await client.goto(reportUrl.replace("/en/", `/${locale}/`));
    await expect(client.getByTestId("report-finding")).toHaveCount(total - 1);
    await axe(client);
  }
  // Ask: off until the client admin opts in; then answers carry citations, unchecked figures
  // never appear, and an out-of-scope question gets the designed "cannot answer".
  const askSwitch = client.getByTestId("org-ask_enabled");
  await client.goto("/en/settings");
  if (await askSwitch.isChecked()) {
    // Start from "off" whatever an earlier run left; wait for the save before leaving.
    await askSwitch.uncheck();
    await expect(client.getByTestId("org-settings-status")).toHaveText("Saved");
  }
  await client.goto(reportUrl);
  await expect(client.getByTestId("ask-off")).toBeVisible();
  await client.goto("/en/settings");
  await askSwitch.check();
  await expect(client.getByTestId("org-settings-status")).toHaveText("Saved");
  await axe(client);
  await client.goto(reportUrl);
  const ask = client.getByTestId("ask-panel");
  await ask.getByRole("button", { name: "Where did we overpay the most?" }).click();
  await expect(ask.getByTestId("ask-sentence")).toHaveCount(1);
  await expect(ask).not.toContainText("999 999");
  await expect(ask).toContainText("Some sentences were removed");
  await ask.getByTestId("ask-cite").first().click();
  await expect(client.getByRole("dialog").getByRole("table")).toBeVisible();
  await client.keyboard.press("Escape");
  await ask.getByLabel("Your question").fill("What will the weather be tomorrow?");
  await ask.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(ask.getByTestId("ask-cannot")).toContainText("I can't answer that from your data");
  await axe(client);
  await client.goto("/en/settings");
  await askSwitch.uncheck();
  await expect(client.getByTestId("org-settings-status")).toHaveText("Saved");

  // The Kazakh PDF carries Kazakh text (embedded font with a Unicode map), not just glyph shapes.
  const kkPdf = await client.request.get(`${reportUrl.replace("/en/", "/kk/")}/pdf`);
  const kkBody = await kkPdf.body();
  await testInfo.attach("report-kk.pdf", { body: kkBody, contentType: "application/pdf" });
  expect(await pdfText(kkBody)).toContain(squash("Ықтимал үнемдеу"));
});
