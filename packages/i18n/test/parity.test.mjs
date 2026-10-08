import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const load = (l) => JSON.parse(readFileSync(new URL(`../messages/${l}.json`, import.meta.url)));
const reference = Object.keys(load("ru")).sort();

for (const locale of ["kk", "en"]) {
  test(`${locale} has exactly the ru keys, none empty`, () => {
    const messages = load(locale);
    assert.deepEqual(Object.keys(messages).sort(), reference);
    for (const [key, value] of Object.entries(messages))
      assert.ok(value.trim(), `${locale}:${key}`);
  });
}
