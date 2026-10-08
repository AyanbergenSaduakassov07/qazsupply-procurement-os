-- M1 domain schema (ADR 0002). Every client-data table: org_id, RLS, explicit grants,
-- composite FKs so a row can never point at another tenant's row.
-- Business logic stays out of SQL: only constraints, RLS, the audit hash chain and evidence reads.
-- Down path: drop the tables in reverse order; no data exists before M2.

-- ---------------------------------------------------------------- helpers
create function private.has_role(target_org uuid, roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;
revoke all on function private.has_role(uuid, public.app_role[]) from public;
grant execute on function private.has_role(uuid, public.app_role[]) to authenticated;

-- Role groups used by policies (kept as SQL functions so every policy reads the same way).
create function private.is_reader(target_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(target_org,
    array['client_admin', 'client_user', 'reviewer', 'qazsupply_admin']::public.app_role[]);
$$;
create function private.is_client(target_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(target_org, array['client_admin', 'client_user']::public.app_role[]);
$$;
create function private.is_staff(target_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(target_org, array['reviewer', 'qazsupply_admin']::public.app_role[]);
$$;
create function private.is_admin(target_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(target_org, array['client_admin', 'qazsupply_admin']::public.app_role[]);
$$;
revoke all on function private.is_reader(uuid), private.is_client(uuid),
  private.is_staff(uuid), private.is_admin(uuid) from public;
grant execute on function private.is_reader(uuid), private.is_client(uuid),
  private.is_staff(uuid), private.is_admin(uuid) to authenticated;

-- ---------------------------------------------------------------- tenancy changes
alter table public.organizations
  add column llm_monthly_budget_usd numeric(10, 2) not null default 50
    check (llm_monthly_budget_usd >= 0);

create policy organizations_update_admin on public.organizations
  for update to authenticated
  using ((select private.is_admin(id))) with check ((select private.is_admin(id)));
grant update (name, llm_monthly_budget_usd) on public.organizations to authenticated;

-- Client admins manage client/supplier memberships; staff roles only by qazsupply_admin.
create policy memberships_insert_admin on public.memberships
  for insert to authenticated with check (
    (select private.has_role(org_id, array['qazsupply_admin']::public.app_role[]))
    or ((select private.has_role(org_id, array['client_admin']::public.app_role[]))
        and role in ('client_admin', 'client_user', 'supplier'))
  );
create policy memberships_update_admin on public.memberships
  for update to authenticated
  using ((select private.is_admin(org_id)))
  with check (
    (select private.has_role(org_id, array['qazsupply_admin']::public.app_role[]))
    or role in ('client_admin', 'client_user', 'supplier')
  );
create policy memberships_delete_admin on public.memberships
  for delete to authenticated using (
    (select private.has_role(org_id, array['qazsupply_admin']::public.app_role[]))
    or ((select private.has_role(org_id, array['client_admin']::public.app_role[]))
        and role in ('client_admin', 'client_user', 'supplier'))
  );
grant insert, delete on public.memberships to authenticated;
grant update (role) on public.memberships to authenticated;

-- ---------------------------------------------------------------- enums
create type public.report_status as enum
  ('draft', 'in_review', 'approved', 'released', 'rejected', 'superseded');
create type public.finding_type as enum
  ('price_variance', 'repeat_purchase', 'split_purchase', 'concentration', 'outlier');
create type public.review_decision as enum ('approve', 'edit', 'reject');
create type public.leg_mode as enum ('road', 'rail', 'sea', 'air');

-- ---------------------------------------------------------------- spend x-ray
create table public.files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(name) between 1 and 255),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint not null check (size_bytes > 0),
  content_type text not null,
  storage_path text not null,
  uploaded_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  unique (org_id, sha256),
  unique (id, org_id)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  bin text check (bin ~ '^[0-9]{12}$'),
  merged_into uuid,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (merged_into, org_id) references public.suppliers (id, org_id)
);
create index suppliers_org_bin_idx on public.suppliers (org_id, bin);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  enstru_code text,
  name text not null check (length(trim(name)) > 0),
  unit text,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create index items_org_code_idx on public.items (org_id, enstru_code);

create table public.purchase_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  file_id uuid not null,
  source_row integer not null check (source_row > 0),
  raw jsonb not null,
  item_text text,
  quantity numeric(18, 4),
  unit text,
  unit_price numeric(18, 4) check (unit_price >= 0),
  currency char(3) check (currency ~ '^[A-Z]{3}$'),
  purchased_on date,
  supplier_text text,
  supplier_id uuid,
  item_id uuid,
  match_confidence numeric(4, 3) check (match_confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (file_id, source_row),
  unique (id, org_id),
  foreign key (file_id, org_id) references public.files (id, org_id) on delete cascade,
  foreign key (supplier_id, org_id) references public.suppliers (id, org_id),
  foreign key (item_id, org_id) references public.items (id, org_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  status public.report_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  released_at timestamptz,
  released_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (id, org_id),
  -- a released report always names who released it and when
  check ((status = 'released') = (released_at is not null and released_by is not null)
         or status = 'superseded')
);
create index reports_org_status_idx on public.reports (org_id, status);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  report_id uuid,
  type public.finding_type not null,
  detector text not null,
  detector_version text not null,
  saving_estimate numeric(18, 2) not null check (saving_estimate >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  method text not null,
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (report_id, org_id) references public.reports (id, org_id) on delete cascade
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  computation_id text not null,
  method text not null,
  code_version text not null,
  inputs jsonb not null default '{}',
  result numeric(18, 4),
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create index evidence_org_idx on public.evidence (org_id);

create table public.evidence_sources (
  evidence_id uuid not null,
  purchase_line_id uuid not null,
  org_id uuid not null references public.organizations (id) on delete cascade,
  primary key (evidence_id, purchase_line_id),
  foreign key (evidence_id, org_id) references public.evidence (id, org_id) on delete cascade,
  foreign key (purchase_line_id, org_id) references public.purchase_lines (id, org_id)
);

create table public.finding_evidence (
  finding_id uuid not null,
  evidence_id uuid not null,
  org_id uuid not null references public.organizations (id) on delete cascade,
  primary key (finding_id, evidence_id),
  foreign key (finding_id, org_id) references public.findings (id, org_id) on delete cascade,
  foreign key (evidence_id, org_id) references public.evidence (id, org_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  report_id uuid not null,
  finding_id uuid,
  reviewer_id uuid not null default auth.uid() references auth.users (id),
  decision public.review_decision not null,
  note text,
  created_at timestamptz not null default now(),
  foreign key (report_id, org_id) references public.reports (id, org_id) on delete cascade,
  foreign key (finding_id, org_id) references public.findings (id, org_id)
);

-- ---------------------------------------------------------------- platform
create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id),
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default clock_timestamp(),
  prev_hash text not null,
  hash text not null
);
create index audit_log_org_id_idx on public.audit_log (org_id, id);

create table public.llm_calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  task text not null,
  prompt_version text not null,
  prompt_sha256 text not null check (prompt_sha256 ~ '^[0-9a-f]{64}$'),
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  redacted boolean not null,
  latency_ms integer check (latency_ms >= 0),
  status text not null check (status in ('ok', 'error', 'timeout', 'blocked_budget', 'blocked_kill_switch')),
  created_at timestamptz not null default now()
);
create index llm_calls_org_month_idx on public.llm_calls (org_id, created_at);

-- ---------------------------------------------------------------- logistics (reserved, no logic until M6)
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, reference)
);

create table public.border_nodes (
  -- Global public reference data (ADR 0006): no org_id; read-only to users.
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  country char(2) not null check (country ~ '^[A-Z]{2}$')
);

create table public.legs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  shipment_id uuid not null,
  seq integer not null check (seq > 0),
  mode public.leg_mode not null,
  carrier text,
  origin text,
  destination text,
  unique (shipment_id, seq),
  foreign key (shipment_id, org_id) references public.shipments (id, org_id) on delete cascade
);

create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  shipment_id uuid not null,
  type text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source text not null,
  source_event_id text not null,
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  raw_sha256 text check (raw_sha256 ~ '^[0-9a-f]{64}$'),
  unique (org_id, source, source_event_id),
  foreign key (shipment_id, org_id) references public.shipments (id, org_id) on delete cascade
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  shipment_id uuid,
  file_id uuid,
  type text not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  foreign key (shipment_id, org_id) references public.shipments (id, org_id),
  foreign key (file_id, org_id) references public.files (id, org_id)
);

-- ---------------------------------------------------------------- FK covering indexes
-- Composite (x_id, org_id) FKs need matching indexes; org-leading indexes cover org_id FKs.
create index purchase_lines_org_idx on public.purchase_lines (org_id);
create index purchase_lines_file_idx on public.purchase_lines (file_id, org_id);
create index purchase_lines_supplier_idx on public.purchase_lines (supplier_id, org_id);
create index purchase_lines_item_idx on public.purchase_lines (item_id, org_id);
create index suppliers_merged_into_idx on public.suppliers (merged_into, org_id);
create index files_uploaded_by_idx on public.files (uploaded_by);
create index reports_released_by_idx on public.reports (released_by);
create index findings_org_idx on public.findings (org_id);
create index findings_report_idx on public.findings (report_id, org_id);
create index evidence_sources_org_idx on public.evidence_sources (org_id);
create index evidence_sources_evidence_idx on public.evidence_sources (evidence_id, org_id);
create index evidence_sources_line_idx on public.evidence_sources (purchase_line_id, org_id);
create index finding_evidence_org_idx on public.finding_evidence (org_id);
create index finding_evidence_finding_idx on public.finding_evidence (finding_id, org_id);
create index finding_evidence_evidence_idx on public.finding_evidence (evidence_id, org_id);
create index reviews_org_idx on public.reviews (org_id);
create index reviews_report_idx on public.reviews (report_id, org_id);
create index reviews_finding_idx on public.reviews (finding_id, org_id);
create index reviews_reviewer_idx on public.reviews (reviewer_id);
create index audit_log_actor_idx on public.audit_log (actor_id);
create index legs_org_idx on public.legs (org_id);
create index legs_shipment_idx on public.legs (shipment_id, org_id);
create index shipment_events_shipment_idx on public.shipment_events (shipment_id, org_id, occurred_at);
create index documents_org_idx on public.documents (org_id);
create index documents_shipment_idx on public.documents (shipment_id, org_id);
create index documents_file_idx on public.documents (file_id, org_id);

-- ---------------------------------------------------------------- append-only guards
create function private.reject_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function private.reject_mutation();
create trigger shipment_events_append_only before update or delete on public.shipment_events
  for each row execute function private.reject_mutation();
create trigger reviews_append_only before update or delete on public.reviews
  for each row execute function private.reject_mutation();

-- Audit hash chain: hash = sha256(prev_hash | org | actor | action | entity | entity_id | details | created_at).
create function private.audit_row_hash(prev text, r public.audit_log) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(concat_ws('|',
    prev, r.org_id::text, coalesce(r.actor_id::text, ''), r.action, r.entity,
    coalesce(r.entity_id::text, ''), r.details::text, to_char(r.created_at at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US')), 'UTF8')), 'hex');
$$;

create function private.audit_chain() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text, 0));
  select a.hash into new.prev_hash from public.audit_log a
    where a.org_id = new.org_id order by a.id desc limit 1;
  new.prev_hash := coalesce(new.prev_hash, repeat('0', 64));
  new.hash := private.audit_row_hash(new.prev_hash, new);
  return new;
end;
$$;
create trigger audit_log_chain before insert on public.audit_log
  for each row execute function private.audit_chain();

-- Returns the id of the first row whose hash does not verify, or null if the chain is intact.
create function private.verify_audit_chain(target_org uuid) returns bigint
language plpgsql stable set search_path = '' as $$
declare
  r public.audit_log;
  prev text := repeat('0', 64);
begin
  for r in select * from public.audit_log where org_id = target_org order by id loop
    if r.prev_hash <> prev or r.hash <> private.audit_row_hash(prev, r) then
      return r.id;
    end if;
    prev := r.hash;
  end loop;
  return null;
end;
$$;

-- The only way for a signed-in user to write an audit entry: actor is always auth.uid().
create function private.append_audit(
  target_org uuid, p_action text, p_entity text, p_entity_id uuid, p_details jsonb
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  new_id bigint;
begin
  if not private.is_member(target_org) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  insert into public.audit_log (org_id, actor_id, action, entity, entity_id, details, prev_hash, hash)
  values (target_org, auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'), '', '')
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function private.append_audit(uuid, text, text, uuid, jsonb) from public;
grant execute on function private.append_audit(uuid, text, text, uuid, jsonb) to authenticated;
revoke all on function private.verify_audit_chain(uuid) from public;
grant execute on function private.verify_audit_chain(uuid) to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.files enable row level security;
alter table public.suppliers enable row level security;
alter table public.items enable row level security;
alter table public.purchase_lines enable row level security;
alter table public.reports enable row level security;
alter table public.findings enable row level security;
alter table public.evidence enable row level security;
alter table public.evidence_sources enable row level security;
alter table public.finding_evidence enable row level security;
alter table public.reviews enable row level security;
alter table public.audit_log enable row level security;
alter table public.llm_calls enable row level security;
alter table public.shipments enable row level security;
alter table public.border_nodes enable row level security;
alter table public.legs enable row level security;
alter table public.shipment_events enable row level security;
alter table public.documents enable row level security;

-- A finding/evidence/review is client-visible only through a released (or superseded) report.
create function private.report_visible(target_report uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.reports r
    where r.id = target_report
      and (private.is_staff(r.org_id)
           or (private.is_client(r.org_id) and r.status in ('released', 'superseded')))
  );
$$;
create function private.evidence_visible(target_evidence uuid, target_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_staff(target_org) or exists (
    select 1 from public.finding_evidence fe
    join public.findings f on f.id = fe.finding_id
    where fe.evidence_id = target_evidence and private.report_visible(f.report_id)
  );
$$;
revoke all on function private.report_visible(uuid), private.evidence_visible(uuid, uuid) from public;
grant execute on function private.report_visible(uuid), private.evidence_visible(uuid, uuid)
  to authenticated;

-- Spend data: every non-supplier member reads; clients and QazSupply admins write raw data.
create policy files_select on public.files for select to authenticated
  using ((select private.is_reader(org_id)));
create policy files_insert on public.files for insert to authenticated
  with check ((select private.has_role(org_id,
    array['client_admin', 'client_user', 'qazsupply_admin']::public.app_role[]))
    and uploaded_by = (select auth.uid()));

create policy suppliers_select on public.suppliers for select to authenticated
  using ((select private.is_reader(org_id)));
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check ((select private.is_reader(org_id)));
create policy suppliers_update on public.suppliers for update to authenticated
  using ((select private.is_reader(org_id))) with check ((select private.is_reader(org_id)));

create policy items_select on public.items for select to authenticated
  using ((select private.is_reader(org_id)));
create policy items_insert on public.items for insert to authenticated
  with check ((select private.is_reader(org_id)));
create policy items_update on public.items for update to authenticated
  using ((select private.is_reader(org_id))) with check ((select private.is_reader(org_id)));

create policy purchase_lines_select on public.purchase_lines for select to authenticated
  using ((select private.is_reader(org_id)));
create policy purchase_lines_insert on public.purchase_lines for insert to authenticated
  with check ((select private.has_role(org_id,
    array['client_admin', 'client_user', 'qazsupply_admin']::public.app_role[])));

-- Reports: staff see every state; clients only released/superseded. Only staff change status.
create policy reports_select on public.reports for select to authenticated
  using ((select private.is_staff(org_id))
    or ((select private.is_client(org_id)) and status in ('released', 'superseded')));
create policy reports_insert on public.reports for insert to authenticated
  with check ((select private.is_staff(org_id)));
create policy reports_update on public.reports for update to authenticated
  using ((select private.is_staff(org_id))) with check ((select private.is_staff(org_id)));

-- Findings and evidence are written by the analysis pipeline (service role) only.
create policy findings_select on public.findings for select to authenticated
  using ((select private.report_visible(report_id)));
create policy evidence_select on public.evidence for select to authenticated
  using ((select private.evidence_visible(id, org_id)));
create policy evidence_sources_select on public.evidence_sources for select to authenticated
  using ((select private.evidence_visible(evidence_id, org_id)));
create policy finding_evidence_select on public.finding_evidence for select to authenticated
  using ((select private.evidence_visible(evidence_id, org_id)));

create policy reviews_select on public.reviews for select to authenticated
  using ((select private.report_visible(report_id)));
create policy reviews_insert on public.reviews for insert to authenticated
  with check ((select private.is_staff(org_id)) and reviewer_id = (select auth.uid()));

create policy audit_log_select on public.audit_log for select to authenticated
  using ((select private.is_admin(org_id)));

create policy llm_calls_select on public.llm_calls for select to authenticated
  using ((select private.is_admin(org_id)));

create policy shipments_select on public.shipments for select to authenticated
  using ((select private.is_reader(org_id)));
create policy legs_select on public.legs for select to authenticated
  using ((select private.is_reader(org_id)));
create policy shipment_events_select on public.shipment_events for select to authenticated
  using ((select private.is_reader(org_id)));
create policy documents_select on public.documents for select to authenticated
  using ((select private.is_reader(org_id)));
create policy border_nodes_select on public.border_nodes for select to authenticated
  using (true);

-- ---------------------------------------------------------------- grants (no auto-grant on this stack)
revoke all on public.files, public.suppliers, public.items, public.purchase_lines, public.reports,
  public.findings, public.evidence, public.evidence_sources, public.finding_evidence,
  public.reviews, public.audit_log, public.llm_calls, public.shipments, public.border_nodes,
  public.legs, public.shipment_events, public.documents from anon, authenticated;

grant select on public.files, public.suppliers, public.items, public.purchase_lines,
  public.reports, public.findings, public.evidence, public.evidence_sources,
  public.finding_evidence, public.reviews, public.audit_log, public.llm_calls, public.shipments,
  public.border_nodes, public.legs, public.shipment_events, public.documents to authenticated;
grant insert on public.files, public.suppliers, public.items, public.purchase_lines,
  public.reports, public.reviews to authenticated;
grant update (name, bin, merged_into) on public.suppliers to authenticated;
grant update (name, enstru_code, unit) on public.items to authenticated;
grant update (status, released_at, released_by, title) on public.reports to authenticated;

-- ---------------------------------------------------------------- evidence drill-down
-- Security invoker: RLS decides what the caller may see; another tenant's id returns null.
create function public.get_evidence(p_evidence_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id,
    'org_id', e.org_id,
    'computation_id', e.computation_id,
    'method', e.method,
    'code_version', e.code_version,
    'inputs', e.inputs,
    'result', e.result,
    'created_at', e.created_at,
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'purchase_line_id', pl.id,
        'file_name', f.name,
        'source_row', pl.source_row,
        'item_text', pl.item_text,
        'supplier_text', pl.supplier_text,
        'quantity', pl.quantity,
        'unit', pl.unit,
        'unit_price', pl.unit_price,
        'currency', pl.currency,
        'purchased_on', pl.purchased_on
      ) order by f.name, pl.source_row)
      from public.evidence_sources es
      join public.purchase_lines pl on pl.id = es.purchase_line_id
      join public.files f on f.id = pl.file_id
      where es.evidence_id = e.id), '[]'::jsonb),
    'findings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'finding_id', fi.id, 'type', fi.type, 'report_id', fi.report_id,
        'reviewed_by', (select rv.reviewer_id from public.reviews rv
                        where rv.finding_id = fi.id order by rv.created_at desc limit 1)
      ))
      from public.finding_evidence fe join public.findings fi on fi.id = fe.finding_id
      where fe.evidence_id = e.id), '[]'::jsonb)
  )
  from public.evidence e
  where e.id = p_evidence_id;
$$;
revoke all on function public.get_evidence(uuid) from public, anon;
grant execute on function public.get_evidence(uuid) to authenticated;
