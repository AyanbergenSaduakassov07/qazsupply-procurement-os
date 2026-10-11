-- M2 role rules on top of the data-driven tenancy suite (m1_rls.test.sql covers cross-tenant access).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create temp table ids as select
  '10000000-0000-4000-a000-00000000000a'::uuid as org_a,
  '00000000-0000-4000-a000-0000000000a2'::uuid as user_a,
  '00000000-0000-4000-a000-0000000000a1'::uuid as admin_a,
  '00000000-0000-4000-a000-0000000000d1'::uuid as supplier,
  '30000000-0000-4000-a000-000000000001'::uuid as line_a;
grant select on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select user_a from ids), 'role', 'authenticated')::text, true);

select lives_ok(
  $$update public.purchase_lines set match_status = 'review', match_method = 'lexical'
    where id = '30000000-0000-4000-a000-000000000001'$$,
  'client_user can update match fields');
select throws_ok(
  $$update public.purchase_lines set unit_price = 1 where id = '30000000-0000-4000-a000-000000000001'$$,
  '42501', null, 'raw purchase values (unit_price) are immutable for users');
select throws_ok(
  $$update public.purchase_lines set raw = '{}' where id = '30000000-0000-4000-a000-000000000001'$$,
  '42501', null, 'raw cell values are immutable for users');
select lives_ok(
  format($$insert into public.match_feedback (org_id, purchase_line_id, action, chosen_code)
           values (%L, %L, 'accept', 'SYN-PPE-001')$$, (select org_a from ids), (select line_a from ids)),
  'a member records review feedback (reviewer defaults to auth.uid())');
select throws_ok(
  format($$insert into public.match_feedback (org_id, purchase_line_id, action, reviewer_id)
           values (%L, %L, 'accept', %L)$$, (select org_a from ids), (select line_a from ids), (select admin_a from ids)),
  '42501', null, 'feedback cannot be signed as someone else');
select throws_ok($$update public.match_feedback set chosen_code = 'x'$$, '42501', null,
  'match_feedback is append-only');

select set_config('request.jwt.claims', json_build_object('sub', (select supplier from ids), 'role', 'authenticated')::text, true);
select is(
  (with u as (select 1) select count(*)::int from public.purchase_lines), 0,
  'supplier role sees no purchase lines');
select throws_ok(
  format($$insert into public.match_feedback (org_id, purchase_line_id, action) values (%L, %L, 'accept')$$,
         (select org_a from ids), (select line_a from ids)),
  '42501', null, 'supplier role cannot write review feedback');

-- Analysis writes: staff only, and only into their own tenant (cross-tenant covered by m1 suite).
select set_config('request.jwt.claims', json_build_object('sub', (select user_a from ids), 'role', 'authenticated')::text, true);
select throws_ok(
  format($$insert into public.evidence (org_id, computation_id, method, code_version) values (%L, 'x', 'm', 'v')$$,
         (select org_a from ids)),
  '42501', null, 'client_user cannot write evidence');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-a000-0000000000c1', 'role', 'authenticated')::text, true);
select lives_ok(
  format($$insert into public.evidence (org_id, computation_id, method, code_version) values (%L, 'x', 'm', 'v')$$,
         (select org_a from ids)),
  'reviewer can write evidence in their org');

-- Controlled purge (runbooks/offboarding.md): DELETE only, never UPDATE, privileged roles only.
reset role;
set local qs.purge = 'on';
select throws_ok($$update public.audit_log set details = '{}'$$, '42501', null,
  'purge mode never allows UPDATE on append-only tables');
set local role authenticated;
select throws_ok($$delete from public.match_feedback$$, '42501', null,
  'purge mode gives app users nothing (no DELETE grant)');

select * from finish();
rollback;
