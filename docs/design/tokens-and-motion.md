# M1 token table and motion spec

Source of truth is `packages/design-tokens/tokens.css`; contrast is asserted by
`packages/design-tokens/test/contrast.test.mjs` (WCAG 2.2 AA: 4.5:1 text, 3:1 UI
boundaries), so this table is a description, not the enforcement.

## Colour tokens (semantic layer)

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--qs-bg` | frost `#EEF1F3` | ink-900 `#0B0F12` | page background |
| `--qs-surface` | white | ink-800 `#12181D` | content surfaces (never glass) |
| `--qs-surface-raised` | `#F7F9FA` | ink-700 `#1A2229` | hover/raised rows |
| `--qs-text` | ink `#101418` | frost `#EEF1F3` | 16.31:1 on frost |
| `--qs-text-muted` | `#5B6770` | `#9BAAB4` | secondary text |
| `--qs-border` | `#D4DBE0` | ink-600 `#2A343C` | separators |
| `--qs-border-strong` | `#6B7680` | `#71808B` | UI boundaries, 4.65:1 / 4.39:1 |
| `--qs-link` / `--qs-focus` | tengri-700 `#076F8C` | tengri-300 `#7AD3E8` | deviation from brand tengri (failed 4.5:1) |
| `--qs-accent` | tengri `#0A8FB4` | tengri-300 | non-text fills, large display |
| `--qs-accent-strong` | tengri-800 `#065E77` | tengri-300 | primary button fill |
| `--qs-on-accent` | white | ink-900 | text on accent-strong |
| `--qs-risk` | risk `#C23B32` | `#F08A82` | always paired with icon + label |
| `--qs-ok` | ok-700 `#276B4E` | `#6FCB9F` | ok-700 because `#2E7D5B` fails on frost |
| `--qs-gold-text` | gold-800 `#7A6114` | gold-300 `#E4C766` | gold is never text on light as `#C9A227` |
| `--qs-nav-active-bg` | rgba(tengri, 0.14) | rgba(tengri-300, 0.18) | active nav item |

Component layer: `--qs-nav-*` (Liquid Glass, controls only), `--qs-card-*`,
`--qs-btn-*`, `--qs-input-*`, `--qs-drawer-*`, `--qs-table-*`, `--qs-touch-target: 44px`.
`--qs-glass-bg`/`--qs-glass-blur` fall back to opaque surfaces under
`prefers-reduced-transparency: reduce` or `[data-reduce-transparency="true"]`.

Type: IBM Plex Sans, tabular figures by default (`docs/design/font-coverage.md`).

## Motion spec

Implemented in `packages/motion` (anime.js v4, subpath imports, `createScope` + `revert`).

| Preset | Properties | Duration | Ease |
|---|---|---|---|
| `fadeIn` / `fadeOut` | opacity | 200 ms | outQuad / inQuad |
| `slideIn` / `slideOut` | opacity, translateY(8px) | 200 ms | outQuad / inQuad |
| `panelIn` / `panelOut` | opacity, translateY, scale(0.98) | 360 / 200 ms | outQuad / inQuad |
| `press` | scale([1, 0.97, 1]) | 200 ms | inOutQuad |

Rules: transform and opacity only; 150-300 ms micro, <= 400 ms complex; interruptible;
stagger step 30 ms clamped to 8 items. Under `prefers-reduced-motion: reduce` every
preset resolves to `duration: 0`, no transform, and `countUp` skips to its end value.
Tailwind peers this with `motion-reduce:transition-none` on interactive primitives.

## Not verified

- Contrast under real webfont rendering and OS colour profiles (tables inspected only).
- Colour-blindness simulation for status colours beyond "never colour alone".
- Motion feel with real users; timings are from the spec, not a study.
