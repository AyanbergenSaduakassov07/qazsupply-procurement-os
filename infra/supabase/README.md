# infra/supabase

Supabase project config, versioned SQL migrations and pgTAP RLS tests (`supabase --workdir infra`).

**Public interface:**
- `migrations/*.sql`: applied in order. M0: `20261008000000_tenancy_baseline.sql` (organizations, memberships, `app_role`, `private.is_member()`, RLS).
- `tests/*.test.sql`: pgTAP. Every RLS policy has a test proving cross-tenant read and write fail.

**Run locally:** `make rls` (= `supabase start --workdir infra && supabase test db --workdir infra`). Reset: `supabase db reset --workdir infra`.

**Rules:** new tables need `org_id`, RLS, explicit grants (this Supabase version does not auto-grant), and a pgTAP test in the same PR. Remote migrations are human-applied only (`docs/runbooks/agent-harness.md`).
