# apps/web

Client app (Next.js App Router): Spend X-ray, suppliers, RFQ, shipments, Ask.

**Public interface (M1):** routes under `/{kk|ru|en}`.
- `/{locale}/sign-in`: email + password sign-in (Supabase Auth), no shell.
- `(app)` group, signed-in only (anonymous users are redirected to sign-in):
  - `/{locale}`: overview for the active org (name, your role, reports you may see, API status).
  - `/{locale}/settings`: theme, reduce transparency, language (the phone path to these).
  - `/{locale}/audit`: audit-log viewer for admins of the active org, with hash-chain status.
  - `/{locale}/gallery`: component gallery, every component and state.
- `/` redirects to `/ru` (default locale pending Q4).

**Session:** `app/actions.ts` signs in via `lib/auth.ts` (Supabase REST, server-side) and stores access + refresh tokens in httpOnly cookies. `proxy.ts` refreshes the access token 60 s before expiry. `lib/session.ts` resolves the user and the **active org** (`qs_org` cookie, honoured only if the user is a member, else the first membership). Navigation and pages follow the role in the active org only. Authorization itself is RLS + API; the web layer only chooses what to show.

**Shell:** glass header (org switcher, disabled Ask entry, notifications, theme and language on tablet/desktop, account with sign-out) + role-aware sidebar; phone menu (anime.js) includes Settings.

**Env:** `API_URL` (default `http://localhost:8000`), `SUPABASE_URL` (default local), `SUPABASE_PUBLISHABLE_KEY` (required for sign-in; `make dev` exports the local one).

**Styling:** Tailwind v4 (`app/globals.css` maps tokens to theme names) + primitives from `@qazsupply/ui`. Strings only from `@qazsupply/i18n`; colours only from `@qazsupply/design-tokens`.

**Not built yet:** notification data, password reset / magic link, per-user time zone (audit times show Asia/Almaty).
