-- M1 tenancy + role suite. Data-driven: every public table with org_id is checked for
-- cross-tenant read, insert, update and delete, so a new table is covered automatically.
-- Uses infra/supabase/seed.sql (orgs A/B, one user per role) plus fixtures below.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ------------------------------------------------------------------ fixtures (as postgres)
create temp table ids as select
  '10000000-0000-4000-a000-00000000000a'::uuid as org_a,
  '10000000-0000-4000-a000-00000000000b'::uuid as org_b,
  '00000000-0000-4000-a000-0000000000a1'::uuid as admin_a,
  '00000000-0000-4000-a000-0000000000a2'::uuid as user_a,
  '00000000-0000-4000-a000-0000000000b1'::uuid as admin_b,
  '00000000-0000-4000-a000-0000000000c1'::uuid as reviewer,
  '00000000-0000-4000-a000-0000000000d1'::uuid as supplier;
grant select on ids to authenticated;

-- One Org B row in every org-scoped table, so "A sees 0 B rows" is meaningful.
insert into public.suppliers (id, org_id, name) values ('70000000-0000-4000-a000-00000000000b', (select org_b from ids), 'B supplier');
insert into public.items (org_id, name) values ((select org_b from ids), 'B item');
insert into public.reports (id, org_id, title, period_start, period_end, status, released_at, released_by)
  values ('40000000-0000-4000-a000-00000000000b', (select org_b from ids), 'B report', '2026-01-01', '2026-03-31',
          'released', now(), (select reviewer from ids));
insert into public.findings (id, org_id, report_id, type, detector, detector_version, saving_estimate, currency, method, confidence)
  values ('50000000-0000-4000-a000-00000000000b', (select org_b from ids), '40000000-0000-4000-a000-00000000000b',
          'outlier', 'outlier', '0.1.0', 1, 'KZT', 'm', 0.5);
insert into public.evidence_sources (evidence_id, purchase_line_id, org_id)
  select '60000000-0000-4000-a000-00000000000b', id, org_id from public.purchase_lines where org_id = (select org_b from ids);
insert into public.finding_evidence values ('50000000-0000-4000-a000-00000000000b', '60000000-0000-4000-a000-00000000000b', (select org_b from ids));
insert into public.reviews (org_id, report_id, reviewer_id, decision) values ((select org_b from ids), '40000000-0000-4000-a000-00000000000b', (select reviewer from ids), 'approve');
insert into public.audit_log (org_id, action, entity, prev_hash, hash) values ((select org_b from ids), 'test.fixture', 'none', '', '');
insert into public.llm_calls (org_id, task, prompt_version, prompt_sha256, model, redacted, status)
  values ((select org_b from ids), 't', 'v1', repeat('c', 64), 'claude-opus-5-5', true, 'ok');
insert into public.shipments (id, org_id, reference) values ('80000000-0000-4000-a000-00000000000b', (select org_b from ids), 'B-1');
insert into public.legs (org_id, shipment_id, seq, mode) values ((select org_b from ids), '80000000-0000-4000-a000-00000000000b', 1, 'rail');
insert into public.shipment_events (org_id, shipment_id, type, occurred_at, source, source_event_id, confidence)
  values ((select org_b from ids), '80000000-0000-4000-a000-00000000000b', 'ShipmentCreated', now(), 'manual', 'b-1', 1);
insert into public.documents (org_id, shipment_id, type) values ((select org_b from ids), '80000000-0000-4000-a000-00000000000b', 'CMR');

create temp view org_tables as
  select c.oid::regclass as t, c.relname::text as name
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped);
grant select on org_tables to authenticated;

-- Count / try-write helpers run with the caller's privileges, so RLS and grants apply.
create function pg_temp.rows_of(t regclass, org uuid) returns bigint language plpgsql as $$
declare n bigint;
begin execute format('select count(*) from %s where org_id = $1', t) into n using org; return n; end $$;
create function pg_temp.try(sql text) returns text language plpgsql as $$
declare n bigint;
begin execute sql; get diagnostics n = row_count; return n::text;
exception when insufficient_privilege then return 'denied';
end $$;
grant execute on function pg_temp.rows_of(regclass, uuid), pg_temp.try(text) to authenticated;

-- ------------------------------------------------------------------ structural guarantees
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'every public table has RLS enabled');
select is(
  (select string_agg(c.relname, ',' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname not in (select name from org_tables)),
  'border_nodes,organizations', 'only reference/tenant-root tables lack org_id');
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert'))),
  0, 'anon has no table privileges in public');
select ok(pg_temp.rows_of(t, (select org_b from ids)) > 0, name || ': fixture has an Org B row')
  from org_tables order by name;

-- ------------------------------------------------------------------ cross-tenant, as client_admin of A
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select admin_a from ids), 'role', 'authenticated')::text, true);

select is(pg_temp.rows_of(t, (select org_b from ids)), 0::bigint, name || ': A cannot read B rows')
  from org_tables order by name;
select ok(pg_temp.try(format('update %s set org_id = org_id where org_id = %L', t, (select org_b from ids))) in ('denied', '0'),
          name || ': A cannot update B rows') from org_tables order by name;
select ok(pg_temp.try(format('delete from %s where org_id = %L', t, (select org_b from ids))) in ('denied', '0'),
          name || ': A cannot delete B rows') from org_tables order by name;

-- Inserts into B: tables without an insert grant fail on privilege; the rest on RLS.
select is(pg_temp.try(format('insert into %s (org_id) values (%L)', t, (select org_b from ids))), 'denied',
          name || ': A cannot insert into B (no grant)')
  from org_tables
  where name not in ('files', 'suppliers', 'items', 'purchase_lines', 'reports', 'reviews', 'memberships')
  order by name;
select throws_ok(format($$insert into public.files (org_id, name, sha256, size_bytes, content_type, storage_path)
  values (%L, 'x.csv', %L, 1, 'text/csv', 'x')$$, (select org_b from ids), repeat('e', 64)), '42501', null, 'files: A cannot insert into B');
select throws_ok(format($$insert into public.suppliers (org_id, name) values (%L, 'x')$$, (select org_b from ids)), '42501', null, 'suppliers: A cannot insert into B');
select throws_ok(format($$insert into public.items (org_id, name) values (%L, 'x')$$, (select org_b from ids)), '42501', null, 'items: A cannot insert into B');
select throws_ok(format($$insert into public.purchase_lines (org_id, file_id, source_row, raw)
  values (%L, '20000000-0000-4000-a000-00000000000b', 99, '{}')$$, (select org_b from ids)), '42501', null, 'purchase_lines: A cannot insert into B');
select throws_ok(format($$insert into public.reports (org_id, title, period_start, period_end)
  values (%L, 'x', '2026-01-01', '2026-01-02')$$, (select org_b from ids)), '42501', null, 'reports: A cannot insert into B');
select throws_ok(format($$insert into public.reviews (org_id, report_id, decision)
  values (%L, '40000000-0000-4000-a000-00000000000b', 'approve')$$, (select org_b from ids)), '42501', null, 'reviews: A cannot insert into B');
select throws_ok(format($$insert into public.memberships (org_id, user_id, role)
  values (%L, %L, 'client_admin')$$, (select org_b from ids), (select admin_a from ids)), '42501', null, 'memberships: A cannot join B');
select throws_ok(format($$insert into public.purchase_lines (org_id, file_id, source_row, raw)
  values (%L, '20000000-0000-4000-a000-00000000000b', 98, '{}')$$, (select org_a from ids)), '23503', null,
  'purchase_lines: an A row cannot point at a B file (composite FK)');
select is(public.get_evidence('60000000-0000-4000-a000-00000000000b'), null, 'get_evidence: B evidence is invisible to A');
select throws_ok(format($$select private.append_audit(%L, 'x.y', 'none', null, '{}')$$, (select org_b from ids)),
  '42501', null, 'append_audit: A cannot write to the B audit log');

-- Role rules inside A, as client_admin.
select throws_ok(format($$insert into public.memberships (org_id, user_id, role) values (%L, %L, 'reviewer')$$,
  (select org_a from ids), (select admin_b from ids)), '42501', null, 'client_admin cannot grant a staff role');
select lives_ok(format($$insert into public.memberships (org_id, user_id, role) values (%L, %L, 'client_user')$$,
  (select org_a from ids), (select admin_b from ids)), 'client_admin can add a client_user');
select is((select count(*)::int from public.audit_log), 2, 'client_admin reads the org audit log');
select is((select count(*)::int from public.reports), 1, 'client_admin sees only the released report');

-- Audit chain via the only write path.
select ok(private.append_audit((select org_a from ids), 'test.appended', 'none', null, '{"k":1}') > 0, 'append_audit works for a member');
select is((select actor_id from public.audit_log order by id desc limit 1), (select admin_a from ids), 'audit actor is auth.uid(), not caller-supplied');
select is(private.verify_audit_chain((select org_a from ids)), null, 'audit chain verifies');

-- ------------------------------------------------------------------ client_user of A
select set_config('request.jwt.claims', json_build_object('sub', (select user_a from ids), 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.reports), 1, 'client_user: unreleased report hidden');
select is((select count(*)::int from public.findings), 1, 'client_user: findings of unreleased report hidden');
select is(public.get_evidence('60000000-0000-4000-a000-0000000000a2'), null, 'client_user: evidence of unreleased finding hidden');
select is(jsonb_array_length(public.get_evidence('60000000-0000-4000-a000-00000000000a') -> 'sources'), 3,
  'get_evidence drills down to all 3 source rows');
select is((select count(*)::int from public.audit_log), 0, 'client_user cannot read the audit log');
select is(pg_temp.try($$update public.reports set title = 'x'$$), '0', 'client_user cannot change reports');
select throws_ok(format($$insert into public.memberships (org_id, user_id, role) values (%L, %L, 'client_user')$$,
  (select org_a from ids), (select admin_b from ids)), '42501', null, 'client_user cannot add members');
select throws_ok(format($$insert into public.reviews (org_id, report_id, decision) values (%L, '40000000-0000-4000-a000-00000000000a', 'approve')$$,
  (select org_a from ids)), '42501', null, 'client_user cannot write reviews');

-- ------------------------------------------------------------------ reviewer and supplier
select set_config('request.jwt.claims', json_build_object('sub', (select reviewer from ids), 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.reports where org_id = (select org_a from ids)), 2, 'reviewer sees draft and released reports');
select is(pg_temp.try($$update public.reports set status = 'in_review' where id = '40000000-0000-4000-a000-0000000000a2'$$), '1',
  'reviewer can move a report to review');
select throws_ok(format($$insert into public.reviews (org_id, report_id, reviewer_id, decision)
  values (%L, '40000000-0000-4000-a000-0000000000a2', %L, 'approve')$$, (select org_a from ids), (select admin_a from ids)),
  '42501', null, 'reviewer cannot sign a review as someone else');

select set_config('request.jwt.claims', json_build_object('sub', (select supplier from ids), 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.purchase_lines), 0, 'supplier role sees no spend data');
select is((select count(*)::int from public.reports), 0, 'supplier role sees no reports');
select is((select count(*)::int from public.files), 0, 'supplier role sees no files');

-- ------------------------------------------------------------------ append-only and tamper evidence (as postgres)
reset role;
select throws_ok($$update public.audit_log set details = '{}'$$, '42501', null, 'audit_log rejects UPDATE even for postgres');
select throws_ok($$delete from public.audit_log$$, '42501', null, 'audit_log rejects DELETE even for postgres');
select throws_ok($$update public.shipment_events set confidence = 0$$, '42501', null, 'shipment_events are append-only');
select throws_ok($$delete from public.reviews$$, '42501', null, 'reviews are append-only');
alter table public.audit_log disable trigger audit_log_append_only;
update public.audit_log set details = '{"tampered":true}'
  where id = (select min(id) from public.audit_log where org_id = (select org_a from ids));
alter table public.audit_log enable trigger audit_log_append_only;
select is(private.verify_audit_chain((select org_a from ids)),
  (select min(id) from public.audit_log where org_id = (select org_a from ids)),
  'verify_audit_chain pinpoints a tampered row');

select * from finish();
rollback;
