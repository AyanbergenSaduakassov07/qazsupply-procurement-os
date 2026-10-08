import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "tokens.css"), "utf8");

/* ---------------------------------------------------------------- tiny CSS parser */
function parse(cssText) {
  const source = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
  const root = { selector: null, decls: {}, children: [] };
  const stack = [root];
  let buffer = "";
  for (const ch of source) {
    if (ch === "{") {
      const node = { selector: buffer.trim(), decls: {}, children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      buffer = "";
    } else if (ch === "}") {
      stack.pop();
      buffer = "";
    } else if (ch === ";") {
      const text = buffer.trim();
      buffer = "";
      const idx = text.indexOf(":");
      if (idx > -1) {
        const key = text.slice(0, idx).trim();
        if (key.startsWith("--")) stack[stack.length - 1].decls[key] = text.slice(idx + 1).trim();
      }
    } else {
      buffer += ch;
    }
  }
  return root;
}

/** Flatten top-level rules (and rules inside @media) in source order. */
function rules(node, out = [], mediaQuery = null) {
  for (const child of node.children) {
    const isMedia = child.selector?.startsWith("@");
    const query = isMedia ? child.selector : mediaQuery;
    out.push({ selector: child.selector, decls: child.decls, mediaQuery: query, isMedia });
    rules(child, out, query);
  }
  return out;
}

const allRules = rules(parse(css));

const matches = (selector, needle) => (selector ?? "").includes(needle);

function themeMap(needles) {
  const map = {};
  for (const rule of allRules) {
    if (rule.mediaQuery) continue;
    if (needles.some((n) => matches(rule.selector, n))) Object.assign(map, rule.decls);
  }
  return map;
}

function resolve(value, map, depth = 0) {
  if (depth > 25) return value;
  const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]*))?\)$/.exec(value.trim());
  if (!m) return value.trim();
  const [, name, fallback] = m;
  if (map[name] !== undefined) return resolve(map[name], map, depth + 1);
  return fallback ? resolve(fallback, map, depth + 1) : value.trim();
}

function parseColor(value) {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.replace(/./g, (c) => c + c);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(v);
  if (fn) {
    const parts = fn[1].split(",").map((p) => Number.parseFloat(p.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }
  throw new Error(`unsupported colour: ${value}`);
}

const luminance = ({ r, g, b }) => {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

function contrast(foreground, background) {
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
  });
  const bg = parseColor(background);
  const fg = over(parseColor(foreground), bg);
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

const light = themeMap([":root", '[data-theme="light"]']);
const dark = themeMap([":root", ".dark", '[data-theme="dark"]']);

function value(map, token) {
  const raw = map[token];
  assert.ok(raw !== undefined, `token ${token} is not defined`);
  return resolve(raw, map);
}

/* ---------------------------------------------------------------- checks */
const TEXT = 4.5; // WCAG 2.2 AA normal text
const LARGE_NON_TEXT = 3; // large text and UI/graphics

const textPairs = [
  ["--qs-text", "--qs-bg"],
  ["--qs-text", "--qs-surface"],
  ["--qs-text-muted", "--qs-bg"],
  ["--qs-text-muted", "--qs-surface"],
  ["--qs-link", "--qs-bg"],
  ["--qs-link", "--qs-surface"],
  ["--qs-risk", "--qs-surface"],
  ["--qs-ok", "--qs-surface"],
  ["--qs-gold-text", "--qs-surface"],
  ["--qs-btn-primary-text", "--qs-btn-primary-bg"],
  ["--qs-nav-fg", "--qs-nav-bg"],
];

const nonTextPairs = [
  ["--qs-focus", "--qs-bg"],
  ["--qs-focus", "--qs-surface"],
  ["--qs-border-strong", "--qs-surface"],
];

for (const [name, map] of [
  ["light", light],
  ["dark", dark],
]) {
  for (const [fg, bg] of textPairs) {
    test(`${name}: ${fg} on ${bg} >= ${TEXT}:1`, () => {
      const ratio = contrast(value(map, fg), value(map, bg));
      assert.ok(ratio >= TEXT, `${name} ${fg} on ${bg} = ${ratio.toFixed(2)}:1`);
    });
  }
  for (const [fg, bg] of nonTextPairs) {
    test(`${name}: ${fg} on ${bg} >= ${LARGE_NON_TEXT}:1`, () => {
      const ratio = contrast(value(map, fg), value(map, bg));
      assert.ok(ratio >= LARGE_NON_TEXT, `${name} ${fg} on ${bg} = ${ratio.toFixed(2)}:1`);
    });
  }
}

test("dark theme overrides every semantic colour token", () => {
  for (const token of [
    "--qs-bg",
    "--qs-surface",
    "--qs-surface-raised",
    "--qs-text",
    "--qs-text-muted",
    "--qs-border",
    "--qs-link",
    "--qs-focus",
    "--qs-accent",
    "--qs-accent-strong",
    "--qs-on-accent",
    "--qs-risk",
    "--qs-ok",
    "--qs-gold-text",
    "--qs-scrim",
  ]) {
    assert.ok(dark[token] !== undefined, `${token} is missing from the dark theme`);
  }
});

test("reduce-transparency falls back to opaque glass", () => {
  const media = allRules.filter((r) =>
    (r.mediaQuery ?? "").includes("prefers-reduced-transparency"),
  );
  assert.ok(media.length > 0, "no prefers-reduced-transparency media query");
  const override = Object.assign({}, ...media.map((r) => r.decls));
  assert.match(resolve(override["--qs-glass-blur"], { ...light, ...override }), /^none$/);
  assert.equal(
    resolve(override["--qs-glass-bg"], { ...light, ...override }),
    resolve(light["--qs-surface"], light),
  );

  const attr = allRules.find((r) => matches(r.selector, 'data-reduce-transparency="true"'));
  assert.ok(attr, "no [data-reduce-transparency] attribute fallback");
  assert.equal(resolve(attr.decls["--qs-glass-blur"], { ...light, ...attr.decls }), "none");
});
