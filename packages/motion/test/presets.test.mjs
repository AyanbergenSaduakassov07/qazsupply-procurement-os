import assert from "node:assert/strict";
import { test } from "node:test";

import {
  countUp,
  durations,
  prefersReducedMotion,
  presets,
  reduceMotionQuery,
  resolvePreset,
  stagger,
  staggerLimit,
} from "../src/presets.js";

const NON_ANIMATED_KEYS = new Set(["duration", "ease", "delay"]);
const ALLOWED_PROPS = new Set([
  "opacity",
  "scale",
  "translateX",
  "translateY",
  "translateZ",
  "rotate",
  "rotateX",
  "rotateY",
]);

test("duration budget matches the motion spec (150-300 micro, <= 400 complex)", () => {
  assert.ok(durations.micro >= 150 && durations.micro <= 300, `micro=${durations.micro}`);
  assert.ok(durations.complex <= durations.max && durations.complex <= 400);
  assert.equal(durations.max, 400);
});

test("every preset animates transform/opacity only", () => {
  for (const [name, preset] of Object.entries(presets)) {
    for (const key of Object.keys(preset)) {
      if (NON_ANIMATED_KEYS.has(key)) continue;
      assert.ok(ALLOWED_PROPS.has(key), `${name} animates non-transform property "${key}"`);
    }
    if (preset.duration !== undefined) {
      assert.ok(preset.duration > 0 && preset.duration <= durations.max, `${name} duration`);
    }
  }
});

test("reduced motion makes every preset instant and static", () => {
  for (const name of Object.keys(presets)) {
    const resolved = resolvePreset(name, { reducedMotion: true });
    assert.equal(resolved.duration, 0, `${name} should be instant`);
    assert.equal(resolved.ease, "linear");
    assert.equal(resolved.delay, 0);
    for (const key of Object.keys(resolved)) {
      if (NON_ANIMATED_KEYS.has(key)) continue;
      assert.fail(`${name} still animates "${key}" under reduced motion`);
    }
  }
});

test("resolvePreset rejects unknown names", () => {
  assert.throws(() => resolvePreset("nope"), /unknown motion preset/);
});

test("stagger is clamped and disabled under reduced motion", () => {
  assert.equal(stagger(0), 0);
  assert.ok(stagger(3) > 0);
  assert.equal(stagger(staggerLimit + 10), stagger(staggerLimit));
  assert.equal(stagger(5, { reducedMotion: true }), 0);
  assert.equal(stagger(-1), 0);
});

test("countUp interpolates and clamps", () => {
  assert.equal(countUp(0, 100, 0), 0);
  assert.equal(countUp(0, 100, 1), 100);
  assert.equal(countUp(0, 100, 0.5), 50);
  assert.equal(countUp(0, 100, -1), 0);
  assert.equal(countUp(0, 100, 2), 100);
});

test("prefersReducedMotion is safe outside a browser", () => {
  const original = globalThis.matchMedia;
  try {
    // @ts-expect-error - deleting an optional global in a test
    delete globalThis.matchMedia;
    assert.equal(prefersReducedMotion(), false);
    globalThis.matchMedia = (query) => ({
      matches: query === reduceMotionQuery,
      addEventListener() {},
      removeEventListener() {},
    });
    assert.equal(prefersReducedMotion(), true);
  } finally {
    globalThis.matchMedia = original;
  }
});
