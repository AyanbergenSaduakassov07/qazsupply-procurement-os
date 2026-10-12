-- M4 Supplier 360 rules on top of the data-driven tenancy suite (m1_rls.test.sql covers
-- cross-tenant access for the new tables automatically).
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

create temp table ids as select
  '10000000-0000-4000-a000-00000000000a'::uuid as org_a,
  '00000000-0000-4000-a000-0000000000a1'::uuid as admin_a,
  '00000000-0000-4000-a000-0000000000a2'::uuid as user_a,
  '00000000-0000-4000-a000-0000000000c1'::uuid as reviewer,
  '00000000-0000-4000-a000-0000000000d1'::uuid as supplier,
  '90000000-0000-4000-a000-0000000000a1'::uuid as company_a,
  '90000000-0000-4000-a000-0000000000a2'::uuid as person_a,
  '91000000-0000-4000-a000-0000000000a1'::uuid as screening_a,
  '92000000-0000-4000-a000-0000000000a1'::uuid as hit_a;
grant select on ids to authenticated;

create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

set local role authenticated;
select pg_temp.as_user((select user_a from ids));

-- ---------------------------------------------------------------- cached registry data
select lives_ok(
  format($$insert into public.parties (id, org_id, kind, name, country, bin, source_id, source_ref, fetched_at, licence, sample)
           values (%L, %L, 'company', 'ТОО «Альфа»', 'KZ', '123456789012', 'registries', 'S-1', now(), 'synthetic sample', true)$$,
         (select company_a from ids), (select org_a from ids)),
  'client_user caches a company from a source');
select lives_ok(
  format($$insert into public.parties (id, org_id, kind, name, country, birth_year, source_id, source_ref, fetched_at, licence, sample)
           values (%L, %L, 'person', 'Айгүл Сапарова', 'KZ', 1979, 'registries', 'S-P1', now(), 'synthetic sample', true)$$,
         (select person_a from ids), (select org_a from ids)),
  'client_user caches a person (name, country, birth year only)');
select throws_ok(
  format($$insert into public.parties (org_id, kind, name, bin, source_id, source_ref, fetched_at, licence, sample)
           values (%L, 'person', 'X', '123456789012', 'registries', 'S-P2', now(), 's', true)$$, (select org_a from ids)),
  '23514', null, 'a person never carries a BIN/IIN (minimisation)');
select throws_ok(
  format($$insert into public.parties (org_id, kind, name, source_id, source_ref, fetched_at, sample)
           values (%L, 'company', 'X', 'registries', 'S-2', now(), true)$$, (select org_a from ids)),
  '23502', null, 'provenance is mandatory (licence)');
select lives_ok(
  format($$insert into public.ownership_links (org_id, owner_id, owned_id, role, share_pct, source_id, fetched_at, licence, sample)
           values (%L, %L, %L, 'beneficial_owner', 60, 'registries', now(), 'synthetic sample', true)$$,
         (select org_a from ids), (select person_a from ids), (select company_a from ids)),
  'client_user records an ownership link');
select throws_ok(
  format($$insert into public.ownership_links (org_id, owner_id, owned_id, role, source_id, fetched_at, licence, sample)
           values (%L, %L, %L, 'shareholder', 'registries', now(), 's', true)$$,
         (select org_a from ids), (select company_a from ids), (select company_a from ids)),
  '23514', null, 'a party cannot own itself');

-- ---------------------------------------------------------------- screening runs and hits
select throws_ok(
  format($$insert into public.screenings (org_id, party_id, list_source, list_version, trigger, result, sample, checked_by)
           values (%L, %L, 'opensanctions', 'v', 'manual', 'clear', true, %L)$$,
         (select org_a from ids), (select person_a from ids), (select admin_a from ids)),
  '42501', null, 'a screening cannot be signed as someone else');
select lives_ok(
  format($$insert into public.screenings (id, org_id, party_id, list_source, list_version, trigger, result, sample)
           values (%L, %L, %L, 'opensanctions', 'sample-1', 'manual', 'possible_match', true)$$,
         (select screening_a from ids), (select org_a from ids), (select person_a from ids)),
  'client_user runs a screening');
select is(
  (select action from public.audit_log where entity_id = (select screening_a from ids)), null,
  'client_user cannot read the audit log (checked as admin below)');
select throws_ok(
  format($$insert into public.screenings (org_id, party_id, item_id, list_source, list_version, trigger, result, sample)
           values (%L, %L, null, 'x', 'v', 'manual', 'clear', true)$$, (select org_a from ids), null),
  '23514', null, 'a screening has exactly one subject (party or item)');
select lives_ok(
  format($$insert into public.screening_hits (id, org_id, screening_id, entry_id, entry_name, score, explanation)
           values (%L, %L, %L, 'SAN-1', 'Aigul Saparova', 93.5, '{"method":"token_set"}')$$,
         (select hit_a from ids), (select org_a from ids), (select screening_a from ids)),
  'the run stores its hits');
select throws_ok($$update public.screenings set result = 'clear'$$, '42501', null, 'screenings are append-only');
select throws_ok($$delete from public.screening_hits$$, '42501', null, 'hits are append-only');

-- ---------------------------------------------------------------- human decisions
select throws_ok(
  format($$insert into public.hit_decisions (org_id, hit_id, decision, reason_code)
           values (%L, %L, 'dismissed', 'different_birth_year')$$, (select org_a from ids), (select hit_a from ids)),
  '42501', null, 'client_user cannot decide a hit');

select pg_temp.as_user((select admin_a from ids));
select throws_ok(
  format($$insert into public.hit_decisions (org_id, hit_id, decision, reason_code)
           values (%L, %L, 'dismissed', 'other')$$, (select org_a from ids), (select hit_a from ids)),
  '23514', null, '"other" needs a note');
select throws_ok(
  format($$insert into public.hit_decisions (org_id, hit_id, decision, reason_code)
           values (%L, %L, 'confirmed', 'different_country')$$, (select org_a from ids), (select hit_a from ids)),
  '23514', null, 'a confirmation cannot cite a dismissal reason');
select lives_ok(
  format($$insert into public.hit_decisions (org_id, hit_id, decision, reason_code)
           values (%L, %L, 'dismissed', 'different_birth_year')$$, (select org_a from ids), (select hit_a from ids)),
  'client_admin dismisses a hit with a reason code');
select is(
  (select actor_id from public.audit_log where action = 'screening.hit_dismissed' order by id desc limit 1),
  (select admin_a from ids), 'the decision is audited with the deciding user');
select is(
  (select actor_id from public.audit_log where action = 'screening.possible_match' and entity_id = (select screening_a from ids)),
  (select user_a from ids), 'the run is audited with the user who ran it');

select pg_temp.as_user((select reviewer from ids));
select lives_ok(
  format($$insert into public.hit_decisions (org_id, hit_id, decision, reason_code, note)
           values (%L, %L, 'confirmed', 'other', 'Registry shows the same person as director')$$,
         (select org_a from ids), (select hit_a from ids)),
  'a reviewer may confirm (a later decision supersedes; history kept)');

-- ---------------------------------------------------------------- supplier role and settings
select pg_temp.as_user((select supplier from ids));
select is((select count(*)::int from public.parties), 0, 'supplier role sees no dossier data');

select pg_temp.as_user((select user_a from ids));
select lives_ok(
  format($$update public.organizations set risk_config = '{"sanctions": 0}' where id = %L$$, (select org_a from ids)),
  'client_user update of risk weights runs');
select is((select risk_config ->> 'sanctions' from public.organizations where id = (select org_a from ids)), null,
  'but changes nothing (admins only)');

select * from finish();
rollback;
