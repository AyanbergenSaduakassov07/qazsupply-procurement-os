# apps/web

Client app (Next.js App Router): Spend X-ray, suppliers, RFQ, shipments, Ask.

**Public interface (M0):** routes `/{kk|ru|en}` (status page: shows API health, language switch). `/` redirects to `/ru` (default locale pending Q4).

**Env:** `API_URL` (default `http://localhost:8000`).

**Rules:** strings only from `@qazsupply/i18n`; colors only from `@qazsupply/design-tokens`. Tailwind + shadcn + app shell arrive in M1.
