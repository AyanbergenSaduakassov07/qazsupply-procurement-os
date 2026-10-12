-- M4 Supplier 360: cached registry facts with provenance, ownership links, screening runs, hits and
-- human decisions (CONTEXT: Party, BeneficialOwner, Screening, Dossier, Risk score).
--
-- Every row from an external source carries source_id, source_ref, fetched_at, licence and a
-- `sample` flag (M4 runs on sample adapters until real access exists; the UI badges them).
-- Persons are minimised: name, country, birth year (needed to tell a sanctions namesake apart).
-- No IIN, address or document numbers are stored for persons.
-- A screening hit never blocks anything here: there is no blocking state at all. A human confirms
-- or dismisses with a reason code (append-only), and every run and decision is audited.
-- Down path: drop the tables below, the enum and organizations.risk_config.

-- ---------------------------------------------------------------- organizations
-- Per-org risk factor weights; documented defaults live in services/supplier360/risk.py.
alter table public.organizations add column risk_config jsonb not null default '{}';
grant update (risk_config) on public.organizations to authenticated;

-- ---------------------------------------------------------------- parties
create type public.party_kind as enum ('company', 'person');

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind public.party_kind not null,
  name text not null check (length(trim(name)) > 0),
  country char(2) check (country ~ '^[A-Z]{2}$'),
  bin text check (bin ~ '^[0-9]{12}$'),
  birth_year smallint check (birth_year between 1900 and 2100),
  registry_status text,
  registered_on date,
  supplier_id uuid,
  source_id text not null,
  source_ref text not null,
  source_url text,
  fetched_at timestamptz not null,
  licence text not null,
  sample boolean not null,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, source_id, source_ref),
  unique (org_id, supplier_id),
  foreign key (supplier_id, org_id) references public.suppliers (id, org_id) on delete set null (supplier_id),
  check (kind = 'company' or (bin is null and registry_status is null and registered_on is null)),
  check (kind = 'person' or birth_year is null)
);
create index parties_supplier_idx on public.parties (supplier_id, org_id);

-- BODS-style interest: owner -> owned, with role and share (docs/research/oss-verification-M4.md).
create table public.ownership_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  owner_id uuid not null,
  owned_id uuid not null,
  role text not null check (role in ('shareholder', 'beneficial_owner', 'director')),
  share_pct numeric(5, 2) check (share_pct > 0 and share_pct <= 100),
  source_id text not null,
  fetched_at timestamptz not null,
  licence text not null,
  sample boolean not null,
  created_at timestamptz not null default now(),
  unique (org_id, owner_id, owned_id, role),
  check (owner_id <> owned_id),
  foreign key (owner_id, org_id) references public.parties (id, org_id) on delete cascade,
  foreign key (owned_id, org_id) references public.parties (id, org_id) on delete cascade
);
create index ownership_links_owner_idx on public.ownership_links (owner_id, org_id);
create index ownership_links_owned_idx on public.ownership_links (owned_id, org_id);

-- ---------------------------------------------------------------- screenings (append-only)
-- One check of one Party (sanctions/PEP) or one Item (dual-use) against a dated list version.
create table public.screenings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  party_id uuid,
  item_id uuid,
  list_source text not null,
  list_version text not null,
  trigger text not null check (trigger in ('manual', 'schedule', 'onboarding', 'order')),
  result text not null check (result in ('clear', 'possible_match', 'unavailable')),
  sample boolean not null,
  checked_by uuid not null default auth.uid() references auth.users (id),
  checked_at timestamptz not null default now(),
  unique (id, org_id),
  check (num_nonnulls(party_id, item_id) = 1),
  foreign key (party_id, org_id) references public.parties (id, org_id) on delete cascade,
  foreign key (item_id, org_id) references public.items (id, org_id) on delete cascade
);
create index screenings_party_idx on public.screenings (party_id, org_id, checked_at desc);
create index screenings_item_idx on public.screenings (item_id, org_id, checked_at desc);
create index screenings_checked_by_idx on public.screenings (checked_by);
create index screenings_org_idx on public.screenings (org_id, checked_at);

create table public.screening_hits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  screening_id uuid not null,
  entry_id text not null,
  entry_name text not null,
  entry_topics text[] not null default '{}',
  entry_url text,
  score numeric(5, 2) not null check (score between 0 and 100),
  explanation jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (id, org_id),
  unique (screening_id, entry_id),
  foreign key (screening_id, org_id) references public.screenings (id, org_id) on delete cascade
);
create index screening_hits_screening_idx on public.screening_hits (screening_id, org_id);
create index screening_hits_org_idx on public.screening_hits (org_id);

-- A named human confirms or dismisses a hit. Latest decision wins; history is kept.
create table public.hit_decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  hit_id uuid not null,
  decision text not null check (decision in ('confirmed', 'dismissed')),
  reason_code text not null check (reason_code in (
    'same_identifiers', 'same_context',
    'different_identifiers', 'different_birth_year', 'different_country', 'different_entity_type',
    'name_only_similarity', 'other')),
  note text,
  decided_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (hit_id, org_id) references public.screening_hits (id, org_id) on delete cascade,
  check (decision = 'confirmed' or reason_code not in ('same_identifiers', 'same_context')),
  check (decision = 'dismissed' or reason_code in ('same_identifiers', 'same_context', 'other')),
  check (reason_code <> 'other' or length(trim(coalesce(note, ''))) > 0)
);
create index hit_decisions_hit_idx on public.hit_decisions (hit_id, org_id, created_at desc);
create index hit_decisions_decided_by_idx on public.hit_decisions (decided_by);
create index hit_decisions_org_idx on public.hit_decisions (org_id, created_at);

create trigger screenings_append_only before update or delete on public.screenings
  for each row execute function private.reject_mutation();
create trigger screening_hits_append_only before update or delete on public.screening_hits
  for each row execute function private.reject_mutation();
create trigger hit_decisions_append_only before update or delete on public.hit_decisions
  for each row execute function private.reject_mutation();

-- Audit every run and decision; the actor is always auth.uid() (append_audit).
create function private.audit_screening() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if tg_table_name = 'screenings' then
      perform private.append_audit(new.org_id, 'screening.' || new.result, 'screenings', new.id,
        jsonb_build_object('party_id', new.party_id, 'item_id', new.item_id,
                           'list_source', new.list_source, 'list_version', new.list_version,
                           'trigger', new.trigger));
    else
      perform private.append_audit(new.org_id, 'screening.hit_' || new.decision, 'hit_decisions', new.id,
        jsonb_build_object('hit_id', new.hit_id, 'reason_code', new.reason_code));
    end if;
  end if;
  return new;
end;
$$;
create trigger screenings_audit after insert on public.screenings
  for each row execute function private.audit_screening();
create trigger hit_decisions_audit after insert on public.hit_decisions
  for each row execute function private.audit_screening();

-- ---------------------------------------------------------------- RLS
alter table public.parties enable row level security;
alter table public.ownership_links enable row level security;
alter table public.screenings enable row level security;
alter table public.screening_hits enable row level security;
alter table public.hit_decisions enable row level security;

-- Readers (client admins/users, reviewers, QazSupply admins) read and refresh the cached
-- registry data; the supplier role sees none of it.
create policy parties_select on public.parties for select to authenticated
  using ((select private.is_reader(org_id)));
create policy parties_insert on public.parties for insert to authenticated
  with check ((select private.is_reader(org_id)));
create policy parties_update on public.parties for update to authenticated
  using ((select private.is_reader(org_id))) with check ((select private.is_reader(org_id)));
create policy ownership_links_select on public.ownership_links for select to authenticated
  using ((select private.is_reader(org_id)));
create policy ownership_links_insert on public.ownership_links for insert to authenticated
  with check ((select private.is_reader(org_id)));
create policy ownership_links_delete on public.ownership_links for delete to authenticated
  using ((select private.is_reader(org_id)));
create policy ownership_links_update on public.ownership_links for update to authenticated
  using ((select private.is_reader(org_id))) with check ((select private.is_reader(org_id)));

create policy screenings_select on public.screenings for select to authenticated
  using ((select private.is_reader(org_id)));
create policy screenings_insert on public.screenings for insert to authenticated
  with check ((select private.is_reader(org_id)) and checked_by = (select auth.uid()));
create policy screening_hits_select on public.screening_hits for select to authenticated
  using ((select private.is_reader(org_id)));
create policy screening_hits_insert on public.screening_hits for insert to authenticated
  with check ((select private.is_reader(org_id)));

-- Decisions: client admins and QazSupply staff, signed as themselves.
create policy hit_decisions_select on public.hit_decisions for select to authenticated
  using ((select private.is_reader(org_id)));
create policy hit_decisions_insert on public.hit_decisions for insert to authenticated
  with check (((select private.is_admin(org_id)) or (select private.is_staff(org_id)))
              and decided_by = (select auth.uid()));

revoke all on public.parties, public.ownership_links, public.screenings, public.screening_hits,
  public.hit_decisions from anon, authenticated;
grant select, insert on public.parties, public.ownership_links, public.screenings,
  public.screening_hits, public.hit_decisions to authenticated;
grant update (name, country, bin, birth_year, registry_status, registered_on, supplier_id,
  source_url, fetched_at, licence, sample) on public.parties to authenticated;
grant delete on public.ownership_links to authenticated;
grant update (share_pct, fetched_at, licence, sample) on public.ownership_links to authenticated;
