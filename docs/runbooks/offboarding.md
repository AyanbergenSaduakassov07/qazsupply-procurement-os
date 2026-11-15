# Offboarding and retention purges

Append-only tables (`audit_log`, `reviews`, `shipment_events`, `match_feedback`) reject UPDATE always and DELETE by default. Deletion is allowed only:
- for a privileged database role (`postgres`, `supabase_admin`, `service_role`),
- inside a transaction that sets `qs.purge = 'on'`,
- as part of an approved offboarding or retention job.

```sql
begin;
set local qs.purge = 'on';
-- export first (CSV + released PDFs) and record the deletion certificate
delete from public.organizations where id = '<org id>';  -- cascades to all tenant rows
commit;
```

Agents never run this against a remote database. Tests use it only on the local stack.
