/**
 * Motion presets and reduced-motion helpers. Pure and DOM-free so they can be
 * unit-tested and imported on the server.
 *
 * Rules (CLAUDE.md / docs/design/design-system.md): transform and opacity only;
 * 150-300 ms micro, <= 400 ms complex; interruptible; a full
 * prefers-reduced-motion behaviour where non-essential motion is disabled.
 */

export const durations = Object.freeze({ micro: 200, complex: 360, max: 400 });

/** Never stagger more than this many items; later items start together. */
export const staggerLimit = 8;

/** Per-item stagger step in ms. */
export const staggerStep = 30;

export const reduceMotionQuery = "(prefers-reduced-motion: reduce)";

/** Named anime.js parameter sets. Only transform/opacity animate. */
export const presets = Object.freeze({
  fadeIn: Object.freeze({ opacity: [0, 1], duration: durations.micro, ease: "outQuad" }),
  fadeOut: Object.freeze({ opacity: [1, 0], duration: durations.micro, ease: "inQuad" }),
  slideIn: Object.freeze({
    opacity: [0, 1],
    translateY: [8, 0],
    duration: durations.micro,
    ease: "outQuad",
  }),
  slideOut: Object.freeze({
    opacity: [1, 0],
    translateY: [0, 8],
    duration: durations.micro,
    ease: "inQuad",
  }),
  panelIn: Object.freeze({
    opacity: [0, 1],
    translateY: [-8, 0],
    scale: [0.98, 1],
    duration: durations.complex,
    ease: "outQuad",
  }),
  panelOut: Object.freeze({
    opacity: [1, 0],
    translateY: [0, -8],
    scale: [1, 0.98],
    duration: durations.micro,
    ease: "inQuad",
  }),
  press: Object.freeze({ scale: [1, 0.97, 1], duration: durations.micro, ease: "inOutQuad" }),
});

/**
 * True when the environment asks us to reduce motion. Safe outside a browser.
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  return (
    typeof globalThis.matchMedia === "function" && globalThis.matchMedia(reduceMotionQuery).matches
  );
}

/**
 * Resolve a preset for the current motion preference. Under reduced motion every
 * transition becomes an instant, static end state (duration 0, no transform).
 * @param {keyof typeof presets} name
 * @param {{ reducedMotion?: boolean }} [options]
 * @returns {Record<string, unknown>}
 */
export function resolvePreset(name, { reducedMotion = false } = {}) {
  const preset = presets[name];
  if (preset === undefined) throw new Error(`unknown motion preset: ${name}`);
  if (!reducedMotion) return preset;
  return { duration: 0, ease: "linear", delay: 0 };
}

/**
 * Stagger delay for item `index`, clamped and disabled under reduced motion.
 * @param {number} index
 * @param {{ reducedMotion?: boolean, limit?: number }} [options]
 * @returns {number}
 */
export function stagger(index, { reducedMotion = false, limit = staggerLimit } = {}) {
  if (reducedMotion || index < 0) return 0;
  return Math.min(index, limit) * staggerStep;
}

/**
 * Eased count-up value; reduced motion should skip straight to `to`.
 * @param {number} from
 * @param {number} to
 * @param {number} progress 0..1
 * @returns {number}
 */
export function countUp(from, to, progress) {
  const t = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  return from + (to - from) * t;
}
