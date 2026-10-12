-- M4 onboarding state machine and role rules (cross-tenant access: m1_rls.test.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

create temp table ids as select
  '10000000-0000-4000-a000-00000000000a'::uuid as org_a,
  '00000000-0000-4000-a000-0000000000a1'::uuid as admin_a,
  '00000000-0000-4000-a000-0000000000a2'::uuid as user_a,
  '00000000-0000-4000-a000-0000000000c1'::uuid as reviewer,
  '00000000-0000-4000-a000-0000000000d1'::uuid as supplier,
  '94000000-0000-4000-a000-0000000000a1'::uuid as case_a;
grant select on ids to authenticated;
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;
set local role authenticated;

-- ---------------------------------------------------------------- invite
select pg_temp.as_user((select user_a from ids));
select throws_ok(
  format($$insert into public.onboarding_cases (org_id, supplier_user_id) values (%L, %L)$$,
         (select org_a from ids), (select supplier from ids)),
  '42501', null, 'a client user cannot invite');
select pg_temp.as_user((select admin_a from ids));
select throws_ok(
  format($$insert into public.onboarding_cases (org_id, supplier_user_id) values (%L, %L)$$,
         (select org_a from ids), (select user_a from ids)),
  '23514', 'onboarding:not_a_supplier_member', 'only a supplier member can be invited');
select lives_ok(
  format($$insert into public.onboarding_cases (id, org_id, supplier_user_id) values (%L, %L, %L)$$,
         (select case_a from ids), (select org_a from ids), (select supplier from ids)),
  'a client admin invites a supplier member');
select is((select supplier_member from (select private.supplier_member_by_email((select org_a from ids), 'SUPPLIER@qazsupply.test') as supplier_member) x),
  (select supplier from ids), 'invite by email resolves a supplier member (case-insensitive)');
select is(private.supplier_member_by_email((select org_a from ids), 'a.user@qazsupply.test'), null,
  'invite by email never resolves a non-supplier');

-- ---------------------------------------------------------------- supplier fills it in
select pg_temp.as_user((select supplier from ids));
select is((select count(*)::int from public.onboarding_cases), 1, 'the supplier sees only its own case');
select lives_ok(
  format($$update public.onboarding_cases set status = 'in_progress', legal_name = 'ТОО «Тест»',
           bin = '123456789012', contact_name = 'Айгүл', contact_phone = '+7 701 000 00 00' where id = %L$$,
         (select case_a from ids)),
  'the supplier starts and fills in details');
select throws_ok(
  format($$update public.onboarding_cases set status = 'submitted', confirmed = true where id = %L$$, (select case_a from ids)),
  '23514', 'onboarding:document_required', 'no submission without a confirmed document');
select throws_ok(
  format($$insert into public.onboarding_documents (org_id, case_id, kind, file_name, content_type, size_bytes, sha256, content)
           values (%L, %L, 'charter', 'c.exe', 'application/x-msdownload', 2, repeat('a', 64), 'MZ'::bytea)$$,
         (select org_a from ids), (select case_a from ids)),
  '23514', null, 'only pdf, png and jpeg are accepted');
select lives_ok(
  format($$insert into public.onboarding_documents (org_id, case_id, kind, file_name, content_type, size_bytes, sha256, content, doc_number, fields_confirmed)
           values (%L, %L, 'registration_certificate', 'reg.pdf', 'application/pdf', 8, repeat('a', 64), '%%PDF-1.4'::bytea, 'R-1', true)$$,
         (select org_a from ids), (select case_a from ids)),
  'the supplier uploads a confirmed document');
select throws_ok($$update public.onboarding_documents set doc_number = 'x'$$, '42501', null, 'documents are append-only');
select throws_ok(
  format($$update public.onboarding_cases set status = 'approved' where id = %L$$, (select case_a from ids)),
  '23514', 'onboarding:transition_not_allowed', 'the supplier cannot approve itself');
select lives_ok(
  format($$update public.onboarding_cases set status = 'submitted', confirmed = true where id = %L$$, (select case_a from ids)),
  'the supplier submits');
select throws_ok(
  format($$update public.onboarding_cases set legal_name = 'x' where id = %L$$, (select case_a from ids)),
  '23514', 'onboarding:locked_for_supplier', 'a submitted case is locked for the supplier');

-- ---------------------------------------------------------------- human check
select pg_temp.as_user((select admin_a from ids));
select throws_ok(
  format($$update public.onboarding_cases set bin = '000000000000' where id = %L$$, (select case_a from ids)),
  '23514', 'onboarding:buyer_cannot_edit_supplier_data', 'the buyer cannot rewrite supplier data');
select throws_ok(
  format($$update public.onboarding_cases set status = 'rejected' where id = %L$$, (select case_a from ids)),
  '23514', 'onboarding:note_required', 'a rejection needs a note');
select pg_temp.as_user((select reviewer from ids));
select lives_ok(
  format($$update public.onboarding_cases set status = 'approved', decision_note = 'Documents match' where id = %L$$, (select case_a from ids)),
  'a reviewer approves');
select is((select decided_by from public.onboarding_cases where id = (select case_a from ids)), (select reviewer from ids),
  'the approver is recorded as the signed-in user');
select pg_temp.as_user((select admin_a from ids));
select is((select actor_id from public.audit_log where action = 'onboarding.approved' order by id desc limit 1),
  (select reviewer from ids), 'approval is audited');
select pg_temp.as_user((select user_a from ids));
select is((select count(*)::int from public.onboarding_documents where case_id = (select case_a from ids)), 1,
  'buyers read the documents');

select * from finish();
rollback;
