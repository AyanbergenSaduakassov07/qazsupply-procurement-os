# packages/design-tokens

Three-layer design tokens (primitive -> semantic -> component), light + dark. Shipped in M1.

**Public interface:** `@qazsupply/design-tokens/tokens.css` defines:

- **Primitive** `--qs-color-*`, `--qs-space-*`, `--qs-radius-*`, `--qs-elevation-*`,
  `--qs-duration-*`, `--qs-font-*`, type scale. Raw values, no meaning.
- **Semantic** `--qs-bg`, `--qs-surface[-raised]`, `--qs-text[-muted]`, `--qs-border[-strong]`,
  `--qs-link`, `--qs-focus`, `--qs-accent[-strong]`, `--qs-on-accent`, `--qs-risk`, `--qs-ok`,
  `--qs-gold-text`, `--qs-scrim`, `--qs-glass-*`. Light is the default; `[data-theme="dark"]`
  (or `.dark`) switches to dark.
- **Component** `--qs-nav-*` (Liquid Glass, controls only), `--qs-card-*`, `--qs-btn-*`,
  `--qs-input-*`, `--qs-drawer-*`, `--qs-table-*`, `--qs-touch-target`.

**Rules**
- Components read **component-layer** tokens only; add a layer-3 token rather than reading
  a primitive.
- Colours come from `docs/design/design-system.md`; contrast-safe derivations and their reasons live in
  `docs/design/design-system.md`.
- Liquid Glass is the navigation/control layer only. Reduce-transparency is a first-class
  fallback via `@media (prefers-reduced-transparency: reduce)` and
  `[data-reduce-transparency="true"]` → opaque surfaces, no blur.
- Every figure uses tabular figures (`--qs-numeric-features`).

**Tests:** `pnpm --filter @qazsupply/design-tokens test` parses `tokens.css` and asserts
WCAG 2.2 AA contrast for both themes (4.5:1 text, 3:1 UI boundaries), that dark overrides
every semantic colour, and that the reduce-transparency fallback is opaque.

**Font:** IBM Plex Sans, chosen after a glyph-coverage test. See `docs/design/font-coverage.md`.
