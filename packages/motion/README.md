# packages/motion

anime.js v4 presets, the `createScope` + `revert` React lifecycle, and
`prefers-reduced-motion` handling. Shipped in M1.

**Public interface**
- `@qazsupply/motion` — `useAnimeScope(setup, deps?)` (returns the scope root ref,
  reverts on unmount/deps change), `useReducedMotion()`, and re-exports
  `animate`, `createScope`.
- `@qazsupply/motion/presets` — DOM-free, server-safe: `presets`, `durations`,
  `resolvePreset(name, { reducedMotion })`, `stagger(index, options)`,
  `countUp(from, to, progress)`, `prefersReducedMotion()`, `reduceMotionQuery`.

**Rules (CLAUDE.md / docs/design/design-system.md)**
- Subpath imports (`animejs/scope`, `animejs/animation`).
- Transform and opacity only. 150-300 ms micro, <= 400 ms complex.
- Interruptible; stagger clamped to `staggerLimit`.
- Full reduced-motion behaviour: every preset resolves to an instant, static end
  state; count-ups are skipped.

**Tests:** `pnpm --filter @qazsupply/motion test` asserts the duration budget, that
no preset animates a non-transform property, and that reduced motion disables
motion. `pnpm --filter @qazsupply/motion typecheck` type-checks the JSDoc/`.d.ts`.
