# packages/i18n

kk / ru / en (uz later) message catalogs. `ru` is the reference catalog; `kk` and `en` must have the same keys (enforced by `pnpm test`).

**Public interface:**
- `locales`, `Locale`, `defaultLocale` (`ru`, pending Q4), `isLocale(value)`
- `t(locale, key)`: typed lookup; `key` must exist in `messages/ru.json`.

**Rules:** no user-facing string outside these catalogs. Kazakh strings need native-speaker review before release (UNVERIFIED in M0). Formal register ("Сіз" / "Вы"); see `docs/design/brand-voice.md`.
