-- LOCAL DEVELOPMENT AND TESTS ONLY. Synthetic data; never applied to a remote project.
-- Test users share one local password (also in e2e/fixtures/users.json). Domain .test is reserved.
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  users text[][] := array[
    ['00000000-0000-4000-a000-0000000000a1', 'a.admin@qazsupply.test'],
    ['00000000-0000-4000-a000-0000000000a2', 'a.user@qazsupply.test'],
    ['00000000-0000-4000-a000-0000000000b1', 'b.admin@qazsupply.test'],
    ['00000000-0000-4000-a000-0000000000c1', 'reviewer@qazsupply.test'],
    ['00000000-0000-4000-a000-0000000000c2', 'qs.admin@qazsupply.test'],
    ['00000000-0000-4000-a000-0000000000d1', 'supplier@qazsupply.test']
  ];
  u text[];
begin
  foreach u slice 1 in array users loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', u[1]::uuid, 'authenticated', 'authenticated',
      u[2], extensions.crypt('qs-local-c98473c4de2a', extensions.gen_salt('bf')), now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}', '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u[1]::uuid, u[1], jsonb_build_object('sub', u[1], 'email', u[2]),
      'email', now(), now(), now());
  end loop;
end $$;

-- Display names for "who reviewed" (synthetic).
update auth.users set raw_user_meta_data = '{"full_name": "Demo Reviewer"}'
  where id = '00000000-0000-4000-a000-0000000000c1';
update auth.users set raw_user_meta_data = '{"full_name": "Demo QazSupply Admin"}'
  where id = '00000000-0000-4000-a000-0000000000c2';

insert into public.organizations (id, name) values
  ('10000000-0000-4000-a000-00000000000a', 'Demo Mining A'),
  ('10000000-0000-4000-a000-00000000000b', 'Demo Logistics B');

insert into public.memberships (org_id, user_id, role) values
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000a1', 'client_admin'),
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000a2', 'client_user'),
  ('10000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-0000000000b1', 'client_admin'),
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000c1', 'reviewer'),
  ('10000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-0000000000c1', 'reviewer'),
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000c2', 'qazsupply_admin'),
  ('10000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-0000000000c2', 'qazsupply_admin'),
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000d1', 'supplier');

-- Org A: one upload, three lines, a released report with one finding and its evidence,
-- and a draft report that clients must not see.
insert into public.files (id, org_id, name, sha256, size_bytes, content_type, storage_path, uploaded_by)
values ('20000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000a',
  'purchases_2026.xlsx', repeat('a', 64), 48213,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'org-a/purchases_2026.xlsx', '00000000-0000-4000-a000-0000000000a1');

insert into public.purchase_lines (id, org_id, file_id, source_row, raw, item_text, quantity, unit,
  unit_price, currency, purchased_on, supplier_text) values
  ('30000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-00000000000a',
   '20000000-0000-4000-a000-00000000000a', 12, '{"A":"Перчатки нитрил. L уп.100"}',
   'Перчатки нитриловые L, уп. 100', 40, 'уп', 18400, 'KZT', '2026-03-14', 'Альфа ТОО'),
  ('30000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-00000000000a',
   '20000000-0000-4000-a000-00000000000a', 57, '{"A":"Перчатки нитриловые L"}',
   'Перчатки нитриловые L, уп. 100', 35, 'уп', 15300, 'KZT', '2026-04-02', 'Бета ТОО'),
  ('30000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-00000000000a',
   '20000000-0000-4000-a000-00000000000a', 88, '{"A":"Қолғап нитрилді L"}',
   'Перчатки нитриловые L, уп. 100', 50, 'уп', 18900, 'KZT', '2026-05-20', 'Альфа ТОО');

insert into public.reports (id, org_id, title, period_start, period_end, status, released_at, released_by)
values
  ('40000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000a',
   'Spend X-ray Q1-Q2 2026', '2026-01-01', '2026-06-30', 'released', now(),
   '00000000-0000-4000-a000-0000000000c1'),
  ('40000000-0000-4000-a000-0000000000a2', '10000000-0000-4000-a000-00000000000a',
   'Spend X-ray Q3 2026 (draft)', '2026-07-01', '2026-09-30', 'draft', null, null);

insert into public.findings (id, org_id, report_id, type, detector, detector_version,
  saving_estimate, currency, method, confidence) values
  ('50000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000a',
   '40000000-0000-4000-a000-00000000000a', 'price_variance', 'price_variance', '0.1.0',
   297500, 'KZT', '(supplier mean - median of others) x quantity', 0.91),
  ('50000000-0000-4000-a000-0000000000a2', '10000000-0000-4000-a000-00000000000a',
   '40000000-0000-4000-a000-0000000000a2', 'repeat_purchase', 'repeat_purchase', '0.1.0',
   120000, 'KZT', 'consolidation estimate', 0.62);

insert into public.evidence (id, org_id, computation_id, method, code_version, inputs, result) values
  ('60000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000a',
   'run-2026-10-07-03', 'price_variance v0.1.0', 'analyze 0.1.0', '{"item":"gloves L"}', 18.4),
  ('60000000-0000-4000-a000-0000000000a2', '10000000-0000-4000-a000-00000000000a',
   'run-2026-10-07-03', 'repeat_purchase v0.1.0', 'analyze 0.1.0', '{}', 120000);
insert into public.evidence_sources (evidence_id, purchase_line_id, org_id) values
  ('60000000-0000-4000-a000-00000000000a', '30000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-00000000000a'),
  ('60000000-0000-4000-a000-00000000000a', '30000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-00000000000a'),
  ('60000000-0000-4000-a000-00000000000a', '30000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-00000000000a'),
  ('60000000-0000-4000-a000-0000000000a2', '30000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-00000000000a');
insert into public.finding_evidence (finding_id, evidence_id, org_id) values
  ('50000000-0000-4000-a000-00000000000a', '60000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000a'),
  ('50000000-0000-4000-a000-0000000000a2', '60000000-0000-4000-a000-0000000000a2', '10000000-0000-4000-a000-00000000000a');
insert into public.reviews (org_id, report_id, finding_id, reviewer_id, decision, note) values
  ('10000000-0000-4000-a000-00000000000a', '40000000-0000-4000-a000-00000000000a',
   '50000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000c1', 'approve', 'Checked rows 12, 57, 88.');

-- Org B: one file and line so cross-tenant tests have something to (not) find.
insert into public.files (id, org_id, name, sha256, size_bytes, content_type, storage_path, uploaded_by)
values ('20000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000b',
  'b_secret_prices.csv', repeat('b', 64), 1200, 'text/csv', 'org-b/b.csv',
  '00000000-0000-4000-a000-0000000000b1');
insert into public.purchase_lines (org_id, file_id, source_row, raw, item_text, unit_price, currency)
values ('10000000-0000-4000-a000-00000000000b', '20000000-0000-4000-a000-00000000000b', 2,
  '{"A":"B confidential"}', 'B confidential item', 999, 'KZT');
insert into public.evidence (id, org_id, computation_id, method, code_version, result) values
  ('60000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000b',
   'run-b', 'manual', 'analyze 0.1.0', 1);

insert into public.border_nodes (code, name, country) values
  ('KZ-DOSTYK', 'Dostyk / Alashankou', 'KZ'), ('KZ-KHORGOS', 'Khorgos / Nur Zholy', 'KZ');

-- Audit entries for Org A (chain computed by trigger).
insert into public.audit_log (org_id, actor_id, action, entity, entity_id, details, prev_hash, hash) values
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000a1', 'file.uploaded', 'files',
   '20000000-0000-4000-a000-00000000000a', '{"rows":3}', '', ''),
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000c1', 'report.released', 'reports',
   '40000000-0000-4000-a000-00000000000a', '{"version":1}', '', '');

-- M2: one review-feedback row in Org B (tenant-isolation tests need a B row in every org table).
insert into public.match_feedback (org_id, purchase_line_id, action, chosen_code, reviewer_id)
select org_id, id, 'accept', 'SYN-PPE-001', '00000000-0000-4000-a000-0000000000b1'
from public.purchase_lines where org_id = '10000000-0000-4000-a000-00000000000b' limit 1;

-- M4: one Org B row in each Supplier 360 table (tenant-isolation suite). Invented sample data.
insert into public.parties (id, org_id, kind, name, country, bin, source_id, source_ref, fetched_at, licence, sample)
values
  ('90000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000b', 'company',
   'ТОО «Б Сэмпл»', 'KZ', '000000000000', 'registries', 'SAMPLE-B-1', now(), 'synthetic sample', true),
  ('90000000-0000-4000-a000-0000000000b2', '10000000-0000-4000-a000-00000000000b', 'person',
   'Sample Person B', 'KZ', null, 'registries', 'SAMPLE-B-P1', now(), 'synthetic sample', true);
insert into public.ownership_links (org_id, owner_id, owned_id, role, share_pct, source_id, fetched_at, licence, sample)
values ('10000000-0000-4000-a000-00000000000b', '90000000-0000-4000-a000-0000000000b2',
  '90000000-0000-4000-a000-00000000000b', 'beneficial_owner', 100, 'registries', now(), 'synthetic sample', true);
insert into public.screenings (id, org_id, party_id, list_source, list_version, trigger, result, sample, checked_by)
values ('91000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000b',
  '90000000-0000-4000-a000-0000000000b2', 'opensanctions', 'sample-2026-10-12', 'manual', 'possible_match', true,
  '00000000-0000-4000-a000-0000000000b1');
insert into public.screening_hits (id, org_id, screening_id, entry_id, entry_name, score)
values ('92000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000b',
  '91000000-0000-4000-a000-00000000000b', 'SAMPLE-SAN-B', 'Sample Persson B', 91);
insert into public.hit_decisions (org_id, hit_id, decision, reason_code, decided_by)
values ('10000000-0000-4000-a000-00000000000b', '92000000-0000-4000-a000-00000000000b', 'dismissed',
  'different_birth_year', '00000000-0000-4000-a000-0000000000b1');

-- M4: Org A suppliers whose BINs exist in the sample registry (connectors/registries), for the
-- Supplier 360 demo and e2e: a chain with sanctions/PEP hits, a 50+ party holding, an unreliable
-- supplier, and a registry outage. Invented data.
insert into public.suppliers (id, org_id, name, bin) values
  ('7a000000-0000-4000-a000-0000000000a1', '10000000-0000-4000-a000-00000000000a', 'ТОО «Альфа»', '123456789012'),
  ('7a000000-0000-4000-a000-0000000000a2', '10000000-0000-4000-a000-00000000000a', 'ТОО «Гамма Индастри»', '100140033333'),
  ('7a000000-0000-4000-a000-0000000000a3', '10000000-0000-4000-a000-00000000000a', 'ТОО «Down»', '990000000001'),
  ('7a000000-0000-4000-a000-0000000000a4', '10000000-0000-4000-a000-00000000000a', 'ТОО «Бета»', '210987654321');

-- M4 onboarding: one Org B case and document (tenant-isolation suite needs a B row per table).
insert into public.onboarding_cases (id, org_id, supplier_user_id, status, legal_name, created_by)
values ('93000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000b',
  '00000000-0000-4000-a000-0000000000b1', 'invited', 'ТОО «Б Сэмпл»', '00000000-0000-4000-a000-0000000000b1');
insert into public.onboarding_documents (org_id, case_id, kind, file_name, content_type, size_bytes, sha256, content, uploaded_by)
values ('10000000-0000-4000-a000-00000000000b', '93000000-0000-4000-a000-00000000000b', 'other', 'b.pdf',
  'application/pdf', 8, encode(sha256('%PDF-1.4'::bytea), 'hex'), '%PDF-1.4'::bytea,
  '00000000-0000-4000-a000-0000000000b1');

-- M5: one Org B row in every procurement table (tenant-isolation suite). Invented data.
insert into public.suppliers (id, org_id, name, bin) values
  ('7b000000-0000-4000-a000-0000000000b1', '10000000-0000-4000-a000-00000000000b', 'ТОО «Б Поставка»', '000000000001');
insert into public.rfqs (id, org_id, title, status, created_by) values
  ('95000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000b', 'B RFQ', 'decided',
   '00000000-0000-4000-a000-0000000000b1');
insert into public.rfq_versions (org_id, rfq_id, version, spec_text, items, created_by) values
  ('10000000-0000-4000-a000-00000000000b', '95000000-0000-4000-a000-00000000000b', 1, 'B spec',
   '[{"name": "B item", "quantity": 1, "unit": "pcs"}]', '00000000-0000-4000-a000-0000000000b1');
insert into public.rfq_approvals (org_id, rfq_id, version, approved_by) values
  ('10000000-0000-4000-a000-00000000000b', '95000000-0000-4000-a000-00000000000b', 1,
   '00000000-0000-4000-a000-0000000000b1');
insert into public.rfq_invites (id, org_id, rfq_id, supplier_id, channel, sent_at, sent_by, created_by) values
  ('96000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000b',
   '95000000-0000-4000-a000-00000000000b', '7b000000-0000-4000-a000-0000000000b1', 'email', now(),
   '00000000-0000-4000-a000-0000000000b1', '00000000-0000-4000-a000-0000000000b1');
insert into public.offers (id, org_id, rfq_id, invite_id, rfq_version, source, currency, lines, entered_by) values
  ('97000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000b',
   '95000000-0000-4000-a000-00000000000b', '96000000-0000-4000-a000-00000000000b', 1, 'email', 'KZT',
   '[{"item": 0, "unit_price": 100}]', '00000000-0000-4000-a000-0000000000b1');
insert into public.offer_confirmations (org_id, offer_id, confirmed_by, by_supplier, note) values
  ('10000000-0000-4000-a000-00000000000b', '97000000-0000-4000-a000-00000000000b',
   '00000000-0000-4000-a000-0000000000b1', false, 'Confirmed by phone');
insert into public.decisions (org_id, rfq_id, offer_id, reason, alternatives, weights, decided_by) values
  ('10000000-0000-4000-a000-00000000000b', '95000000-0000-4000-a000-00000000000b',
   '97000000-0000-4000-a000-00000000000b', 'Only confirmed offer.', '[]', '{}',
   '00000000-0000-4000-a000-0000000000b1');
insert into public.catalogue_entries (id, org_id, name, created_by) values
  ('98000000-0000-4000-a000-0000000000b1', '10000000-0000-4000-a000-00000000000b', 'B entry 1', '00000000-0000-4000-a000-0000000000b1'),
  ('98000000-0000-4000-a000-0000000000b2', '10000000-0000-4000-a000-00000000000b', 'B entry 2', '00000000-0000-4000-a000-0000000000b1');
insert into public.analog_feedback (org_id, entry_id, analog_id, accepted, reviewer_id) values
  ('10000000-0000-4000-a000-00000000000b', '98000000-0000-4000-a000-0000000000b1',
   '98000000-0000-4000-a000-0000000000b2', true, '00000000-0000-4000-a000-0000000000b1');

-- M5: one closed Org A RFQ with two confirmed offers (comparison demo and visual baselines),
-- and two catalogue entries. Invented data; offers entered as 'email' and confirmed by a buyer.
insert into public.rfqs (id, org_id, title, status, deadline, created_by) values
  ('a5000000-0000-4000-a000-0000000000d1', '10000000-0000-4000-a000-00000000000a',
   'Цемент М400, IV квартал', 'closed', '2026-11-30', '00000000-0000-4000-a000-0000000000a2');
insert into public.rfq_versions (org_id, rfq_id, version, spec_text, items, created_by) values
  ('10000000-0000-4000-a000-00000000000a', 'a5000000-0000-4000-a000-0000000000d1', 1,
   'Цемент М400 по ГОСТ 31108-2020, в мешках по 50 кг, доставка до объекта.',
   '[{"name": "Цемент М400", "quantity": 40, "unit": "т"}]', '00000000-0000-4000-a000-0000000000a2');
insert into public.rfq_approvals (org_id, rfq_id, version, approved_by) values
  ('10000000-0000-4000-a000-00000000000a', 'a5000000-0000-4000-a000-0000000000d1', 1,
   '00000000-0000-4000-a000-0000000000a1');
insert into public.rfq_invites (id, org_id, rfq_id, supplier_id, channel, sent_at, sent_by, created_by) values
  ('a6000000-0000-4000-a000-0000000000d1', '10000000-0000-4000-a000-00000000000a',
   'a5000000-0000-4000-a000-0000000000d1', '7a000000-0000-4000-a000-0000000000a1', 'email',
   '2026-10-01 09:00+05', '00000000-0000-4000-a000-0000000000a2', '00000000-0000-4000-a000-0000000000a2'),
  ('a6000000-0000-4000-a000-0000000000d2', '10000000-0000-4000-a000-00000000000a',
   'a5000000-0000-4000-a000-0000000000d1', '7a000000-0000-4000-a000-0000000000a4', 'email',
   '2026-10-01 09:00+05', '00000000-0000-4000-a000-0000000000a2', '00000000-0000-4000-a000-0000000000a2');
insert into public.offers (id, org_id, rfq_id, invite_id, rfq_version, source, currency, payment_days,
  lead_time_days, lines, entered_by, created_at) values
  ('a7000000-0000-4000-a000-0000000000d1', '10000000-0000-4000-a000-00000000000a',
   'a5000000-0000-4000-a000-0000000000d1', 'a6000000-0000-4000-a000-0000000000d1', 1, 'email', 'KZT', 30, 21,
   '[{"item": 0, "unit_price": 31000}]', '00000000-0000-4000-a000-0000000000a2', '2026-10-05 10:00+05'),
  ('a7000000-0000-4000-a000-0000000000d2', '10000000-0000-4000-a000-00000000000a',
   'a5000000-0000-4000-a000-0000000000d1', 'a6000000-0000-4000-a000-0000000000d2', 1, 'email', 'KZT', 45, 35,
   '[{"item": 0, "unit_price": 30500}]', '00000000-0000-4000-a000-0000000000a2', '2026-10-06 10:00+05');
insert into public.offer_confirmations (org_id, offer_id, confirmed_by, by_supplier, note) values
  ('10000000-0000-4000-a000-00000000000a', 'a7000000-0000-4000-a000-0000000000d1',
   '00000000-0000-4000-a000-0000000000a2', false, 'Signed offer letter'),
  ('10000000-0000-4000-a000-00000000000a', 'a7000000-0000-4000-a000-0000000000d2',
   '00000000-0000-4000-a000-0000000000a2', false, 'Signed offer letter');
insert into public.catalogue_entries (org_id, name, unit, attributes, standards, created_by) values
  ('10000000-0000-4000-a000-00000000000a', 'Цемент М400 ПЦ 400-Д20', 'т',
   '{"class": "M400", "packaging": "50 kg"}', '{ГОСТ 31108-2020}', '00000000-0000-4000-a000-0000000000a2'),
  ('10000000-0000-4000-a000-00000000000a', 'Цемент CEM I 42.5', 'т',
   '{"class": "CEM I 42.5", "packaging": "50 kg"}', '{EN 197-1}', '00000000-0000-4000-a000-0000000000a2');
