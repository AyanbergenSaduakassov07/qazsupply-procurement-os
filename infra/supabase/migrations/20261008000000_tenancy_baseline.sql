-- ADR 0002: Postgres + RLS tenancy. M0 baseline: organizations + memberships only.
-- Business tables arrive in M1, each with org_id, RLS and a pgTAP test.

create type public.app_role as enum (
  'client_admin', 'client_user', 'reviewer', 'qazsupply_admin', 'supplier'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

-- Explicit grants (this Supabase version does not auto-grant new tables).
-- Tenant data is never readable without a session; members read, RLS filters rows.
revoke all on public.organizations, public.memberships from anon, authenticated;
grant select on public.organizations, public.memberships to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

-- Helpers live in a schema PostgREST does not expose.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org and m.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_member(uuid) from public;
grant execute on function private.is_member(uuid) to authenticated;

-- Read-only for members. No insert/update/delete policies: writes go through
-- the service role (API) until M1 defines role-aware write policies.
create policy organizations_select_member on public.organizations
  for select to authenticated using ((select private.is_member(id)));

create policy memberships_select_member on public.memberships
  for select to authenticated using ((select private.is_member(org_id)));
