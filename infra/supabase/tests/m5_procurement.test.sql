-- M5 RFQ state machine, human approval/send, supplier portal visibility, offer confirmation,
-- decision records, consented price sharing (cross-tenant access: m1_rls.test.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

create temp table ids as select
  '10000000-0000-4000-a000-00000000000a'::uuid as org_a,
  '00000000-0000-4000-a000-0000000000a1'::uuid as admin_a,
  '00000000-0000-4000-a000-0000000000a2'::uuid as user_a,
  '00000000-0000-4000-a000-0000000000d1'::uuid as supplier,
  '7a000000-0000-4000-a000-0000000000a1'::uuid as alfa,
  '7a000000-0000-4000-a000-0000000000a4'::uuid as beta,
  'a5000000-0000-4000-a000-0000000000a1'::uuid as rfq,
  'a6000000-0000-4000-a000-0000000000a1'::uuid as inv_portal,
  'a6000000-0000-4000-a000-0000000000a2'::uuid as inv_email,
  'a7000000-0000-4000-a000-0000000000a1'::uuid as offer_portal,
  'a7000000-0000-4000-a000-0000000000a2'::uuid as offer_email;
grant select on ids to authenticated;
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;
set local role authenticated;

-- ---------------------------------------------------------------- draft and versions
select pg_temp.as_user((select supplier from ids));
select throws_ok(
  format($$insert into public.rfqs (org_id, title) values (%L, 'x')$$, (select org_a from ids)),
  '42501', null, 'a supplier cannot create an RFQ');

select pg_temp.as_user((select user_a from ids));
select lives_ok(
  format($$insert into public.rfqs (id, org_id, title, deadline) values (%L, %L, 'Цемент М400, 2026 Q4', '2026-11-30')$$,
         (select rfq from ids), (select org_a from ids)),
  'a client user drafts an RFQ');
select lives_ok(
  format($$insert into public.rfq_versions (org_id, rfq_id, version, spec_text, items)
           values (%L, %L, 1, 'Цемент М400 по ГОСТ 31108', '[{"name":"Цемент М400","quantity":40,"unit":"т"}]')$$,
         (select org_a from ids), (select rfq from ids)),
  'version 1 is the draft content');
select throws_ok(
  format($$update public.rfqs set status = 'approved' where id = %L$$, (select rfq from ids)),
  '23514', 'rfq:approval_required', 'no approval, no approved status');
select throws_ok(
  format($$insert into public.rfq_approvals (org_id, rfq_id, version) values (%L, %L, 1)$$,
         (select org_a from ids), (select rfq from ids)),
  '42501', null, 'a client user cannot approve');
select lives_ok(
  format($$insert into public.rfq_invites (id, org_id, rfq_id, supplier_id, supplier_user_id, channel)
           values (%L, %L, %L, %L, %L, 'portal'), (%L, %L, %L, %L, null, 'email')$$,
         (select inv_portal from ids), (select org_a from ids), (select rfq from ids), (select alfa from ids), (select supplier from ids),
         (select inv_email from ids), (select org_a from ids), (select rfq from ids), (select beta from ids)),
  'suppliers are invited while drafting');
select throws_ok(
  format($$update public.rfq_invites set sent_at = now() where id = %L$$, (select inv_email from ids)),
  '23514', 'rfq:approval_required', 'nothing is sent before approval');

select pg_temp.as_user((select supplier from ids));
select is((select count(*)::int from public.rfqs), 0, 'an invited supplier sees nothing before it is sent');

-- ---------------------------------------------------------------- approval, new version, send
select pg_temp.as_user((select admin_a from ids));
select lives_ok(
  format($$insert into public.rfq_approvals (org_id, rfq_id, version, note) values (%L, %L, 1, 'ok')$$,
         (select org_a from ids), (select rfq from ids)),
  'a client admin approves the current draft');
select lives_ok(format($$update public.rfqs set status = 'approved' where id = %L$$, (select rfq from ids)),
  'approved after the approval');
select lives_ok(
  format($$insert into public.rfq_versions (org_id, rfq_id, version, spec_text, items)
           values (%L, %L, 2, 'Цемент М400 по ГОСТ 31108, доставка до 30.11', '[{"name":"Цемент М400","quantity":40,"unit":"т"}]')$$,
         (select org_a from ids), (select rfq from ids)),
  'an edit is a new version');
select is((select status || '/' || current_version from public.rfqs where id = (select rfq from ids)), 'draft/2',
  'a new version re-opens the draft and needs a fresh approval');
select throws_ok(
  format($$update public.rfqs set status = 'approved' where id = %L$$, (select rfq from ids)),
  '23514', 'rfq:approval_required', 'the old approval does not cover version 2');
select lives_ok(
  format($$insert into public.rfq_approvals (org_id, rfq_id, version) values (%L, %L, 2)$$,
         (select org_a from ids), (select rfq from ids)),
  'version 2 approved');
select lives_ok(format($$update public.rfqs set status = 'approved' where id = %L$$, (select rfq from ids)), 'approved v2');
select lives_ok(
  format($$update public.rfq_invites set sent_at = now() where rfq_id = %L$$, (select rfq from ids)),
  'a human records that they sent it');
select lives_ok(format($$update public.rfqs set status = 'sent' where id = %L$$, (select rfq from ids)), 'sent');
select throws_ok(
  format($$insert into public.rfq_versions (org_id, rfq_id, version, items) values (%L, %L, 3, '[{"name":"x","quantity":1,"unit":"т"}]')$$,
         (select org_a from ids), (select rfq from ids)),
  '23514', 'rfq:locked_after_send', 'the sent version is frozen');

-- ---------------------------------------------------------------- offers
select pg_temp.as_user((select supplier from ids));
select is((select count(*)::int from public.rfqs), 1, 'the invited supplier now sees the RFQ');
select lives_ok(
  format($$insert into public.offers (id, org_id, rfq_id, invite_id, source, currency, payment_days, lead_time_days, lines)
           values (%L, %L, %L, %L, 'portal', 'KZT', 30, 14, '[{"item":0,"unit_price":31000}]')$$,
         (select offer_portal from ids), (select org_a from ids), (select rfq from ids), (select inv_portal from ids)),
  'the supplier submits through the portal');

select pg_temp.as_user((select user_a from ids));
select lives_ok(
  format($$insert into public.offers (id, org_id, rfq_id, invite_id, source, currency, lead_time_days, lines)
           values (%L, %L, %L, %L, 'email', 'USD', 21, '[{"item":0,"unit_price":61}]')$$,
         (select offer_email from ids), (select org_a from ids), (select rfq from ids), (select inv_email from ids)),
  'a buyer enters an emailed offer');
select is((select status from public.rfqs where id = (select rfq from ids)), 'collecting', 'the first offer starts collecting');
select is((select count(*)::int from public.offer_confirmations
            where offer_id in ((select offer_portal from ids), (select offer_email from ids))), 1,
  'only the portal offer is confirmed so far');
select throws_ok(
  format($$insert into public.offer_confirmations (org_id, offer_id, by_supplier) values (%L, %L, false)$$,
         (select org_a from ids), (select offer_email from ids)),
  '23514', null, 'a buyer confirms an emailed offer only with a note');

select pg_temp.as_user((select supplier from ids));
select is((select count(*)::int from public.offers), 1, 'a supplier never sees another supplier''s offer');

-- ---------------------------------------------------------------- decision
select pg_temp.as_user((select admin_a from ids));
select throws_ok(
  format($$insert into public.decisions (org_id, rfq_id, offer_id, reason, alternatives, weights)
           values (%L, %L, %L, 'Cheapest confirmed offer', '[]', '{}')$$,
         (select org_a from ids), (select rfq from ids), (select offer_portal from ids)),
  '23514', 'rfq:close_before_deciding', 'collecting must be closed before a decision');
select lives_ok(format($$update public.rfqs set status = 'closed' where id = %L$$, (select rfq from ids)), 'closed');
select throws_ok(
  format($$insert into public.decisions (org_id, rfq_id, offer_id, reason, alternatives, weights)
           values (%L, %L, %L, 'Only because it is in dollars', '[]', '{}')$$,
         (select org_a from ids), (select rfq from ids), (select offer_email from ids)),
  '23514', 'rfq:offer_not_confirmed', 'an unconfirmed offer cannot win');

select pg_temp.as_user((select user_a from ids));
select throws_ok(
  format($$insert into public.decisions (org_id, rfq_id, offer_id, reason, alternatives, weights)
           values (%L, %L, %L, 'Cheapest confirmed offer', '[]', '{}')$$,
         (select org_a from ids), (select rfq from ids), (select offer_portal from ids)),
  '42501', null, 'a client user cannot award (no auto-award, approvers decide)');
select pg_temp.as_user((select admin_a from ids));
select lives_ok(
  format($$insert into public.decisions (org_id, rfq_id, offer_id, reason, alternatives, weights)
           values (%L, %L, %L, 'Cheapest confirmed offer, 14 days lead time', '[{"offer":"email","why":"unconfirmed"}]', '{"price":0.6}')$$,
         (select org_a from ids), (select rfq from ids), (select offer_portal from ids)),
  'a client admin records the decision with a reason and the alternatives');
select lives_ok(format($$update public.rfqs set status = 'decided' where id = %L$$, (select rfq from ids)), 'decided');
select throws_ok(format($$update public.rfqs set title = 'x' where id = %L$$, (select rfq from ids)),
  '23514', 'rfq:closed', 'a decided RFQ is frozen');

-- ---------------------------------------------------------------- shared prices: consent + k >= 5
select is((select count(*)::int from private.shared_price_stats((select org_a from ids), 'SYN-CEM-001')), 0,
  'no consent: no shared aggregate');
update public.organizations set share_prices = true where id = (select org_a from ids);
select is((select count(*)::int from private.shared_price_stats((select org_a from ids), 'SYN-CEM-001')), 0,
  'consent but fewer than 5 organizations: still nothing');

select * from finish();
rollback;
