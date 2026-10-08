# packages/api-client

Typed client generated from the FastAPI OpenAPI schema (openapi-typescript + openapi-fetch).

**Public interface:** `apiClient(baseUrl, accessToken?)` returning a typed `GET/POST/...` client over `paths`; types `Me`, `Membership`, `Evidence`, `AuditLog`, `Report`, `Schemas`.

**Regenerate after any API change:** `pnpm --filter @qazsupply/api-client run generate`. `openapi.json` and `src/schema.d.ts` are committed; CI fails if they drift from the API.
