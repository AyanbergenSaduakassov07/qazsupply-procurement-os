import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * Kazakh must use current Cyrillic orthography. This guards the automated part of
 * docs/design/brand-voice.md: Latin/Cyrillic homoglyph mixing (е for ә, к for қ)
 * and untranslated strings. It cannot judge whether a word is the right Kazakh
 * word — every kk string still needs a native-speaker review before release.
 */

const load = (l) => JSON.parse(readFileSync(new URL(`../messages/${l}.json`, import.meta.url)));
const kk = load("kk");
const ru = load("ru");

// Product/brand tokens, file formats, currency codes and single-letter keyboard shortcuts that
// legitimately appear in kk text. Whole tokens only, so look-alike letters inside words still fail.
const APPROVED_LATIN =
  /\b(QazSupply|API|RFQ|X-ray|KPI|ETA|SAP|Excel|CSV|csv|UTF-8|xlsx|xlsm|xls|KZT|USD|RUB|EUR|CNY|[JKARU])\b/g;
const LATIN = /[A-Za-z]/;
const CYRILLIC = /[\u0400-\u04ff]/;

test("kk never mixes unapproved Latin with Cyrillic (homoglyph guard)", () => {
  for (const [key, value] of Object.entries(kk)) {
    const stripped = value.replace(/\{[a-z_]+\}/g, "").replace(APPROVED_LATIN, ""); // {row} placeholders
    assert.ok(
      !(LATIN.test(stripped) && CYRILLIC.test(value)),
      `${key} mixes Latin and Cyrillic: "${value}"`,
    );
  }
});

test("kk has no untranslated multi-word string copied from ru", () => {
  for (const [key, value] of Object.entries(kk)) {
    if (value.trim().split(/\s+/).length < 2) continue;
    assert.notEqual(value, ru[key], `${key} is identical to the Russian string ("${value}")`);
  }
});

test("kk uses Kazakh-specific letters somewhere in the catalogue", () => {
  const kazakhSpecific = /[әғқңөұүһі]/i;
  assert.ok(
    Object.values(kk).some((value) => kazakhSpecific.test(value)),
    "no kk string uses a Kazakh-specific letter; is this really Kazakh?",
  );
});
