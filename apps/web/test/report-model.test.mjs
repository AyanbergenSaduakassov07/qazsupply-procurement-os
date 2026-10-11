import assert from "node:assert/strict";
import { test } from "node:test";

import { buildReportModel, dateFormatter, moneyFormatter, toTiyn } from "../lib/report-model.ts";

const finding = (id, type, saving, confidence, decision = "approve") => ({
  id,
  type,
  saving_estimate: saving,
  confidence,
  method: "m",
  item_name: id,
  enstru_code: null,
  supplier_name: null,
  evidence_id: `ev-${id}`,
  decision,
  decision_note: null,
  decided_by_name: "Demo Reviewer",
  decided_at: "2026-10-12T10:00:00Z",
});

test("rejected findings never count, and ranking is money first, then confidence", () => {
  const model = buildReportModel([
    finding("a", "outlier", "100.00", "0.40"),
    finding("b", "price_variance", "500.00", "0.90"),
    finding("c", "price_variance", "100.00", "0.95"),
    finding("x", "split_purchase", "9999.00", "0.99", "reject"),
  ]);
  assert.deepEqual(
    model.ranked.map((f) => f.id),
    ["b", "c", "a"],
  );
  assert.equal(model.totalTiyn, 70_000);
  assert.deepEqual(
    model.byType.map((t) => [t.type, t.count, t.tiyn]),
    [
      ["price_variance", 2, 60_000],
      ["outlier", 1, 10_000],
    ],
  );
});

test("money is summed exactly in tiyn (no float drift)", () => {
  const parts = ["0.10", "0.20", "1234567.89"];
  const model = buildReportModel(parts.map((s, i) => finding(`f${i}`, "outlier", s, "0.5")));
  assert.equal(model.totalTiyn, 123_456_819);
  assert.equal(toTiyn("0.10") + toTiyn("0.20"), 30);
});

test("top N and the rest split the ranking without overlap", () => {
  const many = Array.from({ length: 7 }, (_, i) =>
    finding(`f${i}`, "outlier", `${i + 1}.00`, "0.5"),
  );
  const model = buildReportModel(many, 5);
  assert.equal(model.top.length, 5);
  assert.equal(model.rest.length, 2);
  assert.equal(new Set([...model.top, ...model.rest].map((f) => f.id)).size, 7);
});

test("money and dates look the same in every runtime (no Intl locale data)", () => {
  const nb = "\u00a0";
  assert.equal(moneyFormatter("kk")(123_456_819), `1${nb}234${nb}568${nb}₸`);
  assert.equal(moneyFormatter("ru")(29_750_000), `297${nb}500${nb}₸`);
  assert.equal(moneyFormatter("en")(29_750_000), "₸297,500");
  assert.equal(moneyFormatter("en")(49), "₸0");
  assert.equal(dateFormatter("kk")("2026-01-05"), "2026 ж. 5 қаңтар");
  assert.equal(dateFormatter("ru")("2026-03-11"), "11 марта 2026 г.");
  assert.equal(dateFormatter("en")("2026-10-11T22:30:00Z"), "12 October 2026"); // Almaty day
});
