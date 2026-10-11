-- M3 review gate: a report reaches a client only through draft -> in_review -> approved -> released,
-- with a decision on every finding, an audit entry on every step, and an optional four-eyes rule.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ------------------------------------------------------------------ fixtures (as postgres)
create temp table ids as select
  '10000000-0000-4000-a000-00000000000a'::uuid as org_a,
  '00000000-0000-4000-a000-0000000000a1'::uuid as admin_a,
  '00000000-0000-4000-a000-0000000000a2'::uuid as user_a,
  '00000000-0000-4000-a000-0000000000c1'::uuid as reviewer,
  '00000000-0000-4000-a000-0000000000c2'::uuid as qs_admin,
  '4e000000-0000-4000-a000-000000000001'::uuid as rpt,
  '5e000000-0000-4000-a000-000000000001'::uuid as f_keep,
  '5e000000-0000-4000-a000-000000000002'::uuid as f_drop,
  '6e000000-0000-4000-a000-000000000001'::uuid as e_keep,
  '6e000000-0000-4000-a000-000000000002'::uuid as e_drop;
grant select on ids to authenticated;

insert into public.reports (id, org_id, title, period_start, period_end)
  select rpt, org_a, 'Gate test', '2026-01-01', '2026-03-31' from ids;
insert into public.findings (id, org_id, report_id, type, detector, detector_version,
  saving_estimate, currency, method, confidence)
  select f_keep, org_a, rpt, 'price_variance'::public.finding_type, 'price_variance', '0.1.0', 1000, 'KZT', 'm', 0.9 from ids
  union all
  select f_drop, org_a, rpt, 'outlier'::public.finding_type, 'outlier', '0.1.0', 500, 'KZT', 'm', 0.4 from ids;
insert into public.evidence (id, org_id, computation_id, method, code_version, result)
  select e_keep, org_a, 'gate-test', 'm', 't', 1000 from ids
  union all select e_drop, org_a, 'gate-test', 'm', 't', 500 from ids;
insert into public.finding_evidence select f_keep, e_keep, org_a from ids;
insert into public.finding_evidence select f_drop, e_drop, org_a from ids;

create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.audit_count(act text) returns int language sql security definer as $$
  select count(*)::int from public.audit_log where action = act and created_at >= now(); -- this test's rows only
$$;
grant execute on function pg_temp.as_user(uuid), pg_temp.audit_count(text) to authenticated;

set local role authenticated;

-- ------------------------------------------------------------------ reports start as draft
select pg_temp.as_user((select reviewer from ids));
select throws_ok(format($$insert into public.reports (org_id, title, period_start, period_end, status, released_at, released_by)
  values (%L, 'x', '2026-01-01', '2026-01-31', 'released', now(), %L)$$, (select org_a from ids), (select reviewer from ids)),
  '23514', 'review_gate:reports_start_as_draft', 'a report cannot be created already released');
select throws_ok($$update public.reports set status = 'approved' where id = '4e000000-0000-4000-a000-000000000001'$$,
  '23514', 'review_gate:transition_not_allowed', 'draft cannot jump to approved');
select throws_ok($$update public.reports set status = 'released' where id = '4e000000-0000-4000-a000-000000000001'$$,
  '23514', 'review_gate:transition_not_allowed', 'draft cannot jump to released');
select throws_ok(format($$insert into public.reviews (org_id, report_id, finding_id, decision)
  values (%L, %L, %L, 'approve')$$, (select org_a from ids), (select rpt from ids), (select f_keep from ids)),
  '23514', 'review_gate:report_not_in_review', 'no decisions on a draft report');

-- ------------------------------------------------------------------ submit for review
select lives_ok($$update public.reports set status = 'in_review' where id = '4e000000-0000-4000-a000-000000000001'$$,
  'reviewer submits the draft for review');
select isnt((select submitted_at from public.reports where id = (select rpt from ids)), null, 'submission time is recorded (SLA timer)');
select is(pg_temp.audit_count('report.in_review'), 1, 'submission is audited');
select throws_ok(format($$insert into public.findings (org_id, report_id, type, detector, detector_version,
  saving_estimate, currency, method, confidence) values (%L, %L, 'outlier', 'o', '1', 1, 'KZT', 'm', 0.5)$$,
  (select org_a from ids), (select rpt from ids)),
  '23514', 'review_gate:findings_frozen', 'findings are frozen once the report is in review');

-- ------------------------------------------------------------------ finding decisions
select throws_ok(format($$insert into public.reviews (org_id, report_id, decision) values (%L, %L, 'approve')$$,
  (select org_a from ids), (select rpt from ids)),
  '23514', 'review_gate:undecided_findings', 'the report cannot be approved while a finding is undecided');
select throws_ok(format($$insert into public.reviews (org_id, report_id, finding_id, decision) values (%L, %L, %L, 'reject')$$,
  (select org_a from ids), (select rpt from ids), (select f_drop from ids)),
  '23514', 'review_gate:note_required', 'a rejection needs a note');
select lives_ok(format($$insert into public.reviews (org_id, report_id, finding_id, decision, note) values (%L, %L, %L, 'reject', 'one-off emergency order')$$,
  (select org_a from ids), (select rpt from ids), (select f_drop from ids)), 'reviewer rejects a finding with a note');
select lives_ok(format($$insert into public.reviews (org_id, report_id, finding_id, decision, note) values (%L, %L, %L, 'edit', 'Confirmed with the buyer')$$,
  (select org_a from ids), (select rpt from ids), (select f_keep from ids)), 'reviewer edits a finding note');
select is(pg_temp.audit_count('review.reject') + pg_temp.audit_count('review.edit'), 2, 'every decision is audited');
select throws_ok($$update public.reports set status = 'approved' where id = '4e000000-0000-4000-a000-000000000001'$$,
  '23514', 'review_gate:approval_review_required', 'approval needs a signed approval review');
select lives_ok(format($$insert into public.reviews (org_id, report_id, decision) values (%L, %L, 'approve')$$,
  (select org_a from ids), (select rpt from ids)), 'reviewer signs the report-level approval');
select lives_ok($$update public.reports set status = 'approved' where id = '4e000000-0000-4000-a000-000000000001'$$,
  'reviewer approves the report');
select throws_ok(format($$insert into public.reviews (org_id, report_id, finding_id, decision) values (%L, %L, %L, 'approve')$$,
  (select org_a from ids), (select rpt from ids), (select f_drop from ids)),
  '23514', 'review_gate:report_not_in_review', 'no decisions after approval (reopen first)');

-- ------------------------------------------------------------------ approved is still invisible to clients
select pg_temp.as_user((select user_a from ids));
select is((select count(*)::int from public.reports where id = (select rpt from ids)), 0, 'client cannot see an approved, unreleased report');
select is((select count(*)::int from public.findings where report_id = (select rpt from ids)), 0, 'client cannot see its findings');

-- ------------------------------------------------------------------ release
select pg_temp.as_user((select reviewer from ids));
select lives_ok($$update public.reports set status = 'released', released_by = '00000000-0000-4000-a000-0000000000a1' where id = '4e000000-0000-4000-a000-000000000001'$$,
  'reviewer releases the approved report');
select is((select released_by from public.reports where id = (select rpt from ids)), (select reviewer from ids),
  'released_by is the caller, not a caller-supplied value');
select is(pg_temp.audit_count('report.released'), 1, 'release is audited');
select throws_ok($$update public.reports set title = 'changed' where id = '4e000000-0000-4000-a000-000000000001'$$,
  '23514', 'review_gate:report_closed', 'a released report is frozen');
select throws_ok($$update public.reports set status = 'approved' where id = '4e000000-0000-4000-a000-000000000001'$$,
  '23514', 'review_gate:report_closed', 'a released report cannot be un-released');

-- ------------------------------------------------------------------ client sees only kept findings
select pg_temp.as_user((select user_a from ids));
select is((select count(*)::int from public.reports where id = (select rpt from ids)), 1, 'client sees the released report');
select is((select array_agg(id) from public.findings where report_id = (select rpt from ids)), array[(select f_keep from ids)],
  'client sees approved/edited findings, never rejected ones');
select is(public.get_evidence((select e_drop from ids)), null, 'evidence of a rejected finding stays hidden');
select isnt(public.get_evidence((select e_keep from ids)), null, 'evidence of a kept finding is visible');
select is((select count(*)::int from public.reviews where finding_id = (select f_drop from ids)), 0,
  'the internal note on a rejected finding stays hidden');

-- ------------------------------------------------------------------ organization settings
select pg_temp.as_user((select admin_a from ids));
select lives_ok(format($$update public.organizations set ask_enabled = true where id = %L$$, (select org_a from ids)),
  'client_admin opts in to Ask');
select throws_ok(format($$update public.organizations set four_eyes = true where id = %L$$, (select org_a from ids)),
  '42501', null, 'client_admin cannot change four_eyes');
select pg_temp.as_user((select qs_admin from ids));
select lives_ok(format($$update public.organizations set four_eyes = true where id = %L$$, (select org_a from ids)),
  'QazSupply admin turns on four_eyes');

-- ------------------------------------------------------------------ four eyes
select pg_temp.as_user((select reviewer from ids));
select lives_ok(format($$insert into public.reports (id, org_id, title, period_start, period_end)
  values ('4e000000-0000-4000-a000-000000000002', %L, 'Four eyes', '2026-01-01', '2026-01-31')$$, (select org_a from ids)),
  'reviewer runs an analysis (creates a draft)');
select is((select created_by from public.reports where id = '4e000000-0000-4000-a000-000000000002'), (select reviewer from ids),
  'created_by is the caller');
select lives_ok($$update public.reports set status = 'in_review' where id = '4e000000-0000-4000-a000-000000000002'$$, 'submitted');
select lives_ok(format($$insert into public.reviews (org_id, report_id, decision) values (%L, '4e000000-0000-4000-a000-000000000002', 'approve')$$,
  (select org_a from ids)), 'runner may sign an approval review');
select throws_ok($$update public.reports set status = 'approved' where id = '4e000000-0000-4000-a000-000000000002'$$,
  '23514', 'review_gate:four_eyes_runner_cannot_approve', 'but cannot approve their own run');
select pg_temp.as_user((select qs_admin from ids));
select lives_ok(format($$insert into public.reviews (org_id, report_id, decision) values (%L, '4e000000-0000-4000-a000-000000000002', 'approve')$$,
  (select org_a from ids)), 'a second person signs the approval');
select lives_ok($$update public.reports set status = 'approved' where id = '4e000000-0000-4000-a000-000000000002'$$, 'and approves');
select throws_ok($$update public.reports set status = 'released' where id = '4e000000-0000-4000-a000-000000000002'$$,
  '23514', 'review_gate:four_eyes_approver_cannot_release', 'the approver cannot also release');
select pg_temp.as_user((select reviewer from ids));
select lives_ok($$update public.reports set status = 'released' where id = '4e000000-0000-4000-a000-000000000002'$$,
  'a different person releases');

-- ------------------------------------------------------------------ reviewer names ("who reviewed")
select pg_temp.as_user((select user_a from ids));
select is(private.staff_name((select reviewer from ids)), 'Demo Reviewer', 'a client sees the name of a reviewer of their org');
select is(private.staff_name((select admin_a from ids)), null, 'names are only returned for staff, not for client users');
select is(private.staff_name('00000000-0000-4000-a000-0000000000b1'), null, 'another org''s client admin stays anonymous');

select * from finish();
rollback;
