begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Fixtures (as postgres, bypassing RLS).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test');
insert into public.organizations (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'Org A'),
  ('10000000-0000-0000-0000-00000000000b', 'Org B');
insert into public.memberships (org_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'client_admin'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'client_admin');

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.organizations'::regclass, 'public.memberships'::regclass)),
  'RLS enabled on every M0 table'
);

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select results_eq(
  'select name from public.organizations',
  $$values ('Org A'::text)$$,
  'user A sees only Org A'
);
select is_empty(
  $$select 1 from public.memberships where org_id = '10000000-0000-0000-0000-00000000000b'$$,
  'user A cannot read Org B memberships'
);
select throws_ok(
  $$insert into public.organizations (name) values ('Sneaky')$$,
  '42501', null,
  'user A cannot create organizations directly'
);
select throws_ok(
  $$insert into public.memberships (org_id, user_id, role)
    values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'client_admin')$$,
  '42501', null,
  'user A cannot add themself to Org B'
);

select throws_ok(
  $$update public.organizations set name = 'Hijacked' where id = '10000000-0000-0000-0000-00000000000b'$$,
  '42501', null,
  'user A cannot update Org B'
);
select throws_ok(
  $$delete from public.organizations where id = '10000000-0000-0000-0000-00000000000b'$$,
  '42501', null,
  'user A cannot delete Org B'
);

-- Anonymous sees nothing.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok('select 1 from public.organizations', '42501', null, 'anon has no table privilege');

reset role;
select is(
  (select name from public.organizations where id = '10000000-0000-0000-0000-00000000000b'),
  'Org B',
  'Org B is unchanged'
);
select is(
  (select count(*)::int from public.memberships),
  2,
  'no membership rows were added'
);

select * from finish();
rollback;
