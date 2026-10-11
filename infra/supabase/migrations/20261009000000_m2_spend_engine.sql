-- M2 Spend X-ray engine: ingest metadata, normalised line fields, match review loop, finding subjects.
-- Down path: drop match_feedback; drop the added columns; no client data exists before M2.

-- ---------------------------------------------------------------- organizations
-- Per-org analysis thresholds; documented defaults live in services/analyze/config.py.
alter table public.organizations add column analysis_config jsonb not null default '{}';
grant update (analysis_config) on public.organizations to authenticated;

-- ---------------------------------------------------------------- files (upload metadata)
alter table public.files
  add column sheet text,
  add column header_row integer check (header_row >= 1),
  add column mapping jsonb not null default '{}',
  add column rows_total integer not null default 0 check (rows_total >= 0),
  add column rows_rejected integer not null default 0 check (rows_rejected >= 0),
  add column row_errors jsonb not null default '[]';

-- ---------------------------------------------------------------- purchase_lines (normalised fields)
alter table public.purchase_lines
  add column supplier_bin text check (supplier_bin ~ '^[0-9]{12}$'),
  add column unit_norm text,
  add column unit_price_kzt numeric(18, 4) check (unit_price_kzt >= 0),
  add column fx_rate numeric(18, 6) check (fx_rate > 0),
  add column fx_date date,
  add column match_status text not null default 'pending'
    check (match_status in ('pending', 'auto', 'review', 'confirmed', 'rejected', 'bundled')),
  add column match_method text,
  add column match_candidates jsonb not null default '[]',
  add column row_warnings text[] not null default '{}';
create index purchase_lines_match_status_idx on public.purchase_lines (org_id, match_status);

-- Matching and review update lines in place (raw values stay untouched in `raw`).
create policy purchase_lines_update on public.purchase_lines for update to authenticated
  using ((select private.is_reader(org_id))) with check ((select private.is_reader(org_id)));
grant update (item_id, supplier_id, match_status, match_method, match_confidence, match_candidates,
  unit_norm, unit_price_kzt, fx_rate, fx_date) on public.purchase_lines to authenticated;

-- ---------------------------------------------------------------- findings (subject)
alter table public.findings
  add column item_id uuid,
  add column supplier_id uuid,
  add column details jsonb not null default '{}',
  add foreign key (item_id, org_id) references public.items (id, org_id),
  add foreign key (supplier_id, org_id) references public.suppliers (id, org_id);
create index findings_item_idx on public.findings (item_id, org_id);
create index findings_supplier_idx on public.findings (supplier_id, org_id);

-- ---------------------------------------------------------------- match_feedback (review loop -> evals)
create table public.match_feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  purchase_line_id uuid not null,
  action text not null check (action in ('accept', 'choose', 'reject', 'undo')),
  previous_code text,
  chosen_code text,
  reviewer_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (purchase_line_id, org_id) references public.purchase_lines (id, org_id) on delete cascade
);
create index match_feedback_org_idx on public.match_feedback (org_id, created_at);
create index match_feedback_line_idx on public.match_feedback (purchase_line_id, org_id);
create index match_feedback_reviewer_idx on public.match_feedback (reviewer_id);

alter table public.match_feedback enable row level security;
create trigger match_feedback_append_only before update or delete on public.match_feedback
  for each row execute function private.reject_mutation();

create policy match_feedback_select on public.match_feedback for select to authenticated
  using ((select private.is_reader(org_id)));
create policy match_feedback_insert on public.match_feedback for insert to authenticated
  with check ((select private.is_reader(org_id)) and reviewer_id = (select auth.uid()));
revoke all on public.match_feedback from anon, authenticated;
grant select, insert on public.match_feedback to authenticated;

-- ---------------------------------------------------------------- controlled purge (offboarding)
-- Append-only tables reject UPDATE/DELETE, which also blocked tenant offboarding (cascade from
-- organizations) required by docs/compliance/retention-policy.md. A privileged session may set
-- `qs.purge = 'on'` for one transaction (runbook: docs/runbooks/offboarding.md). App users have no
-- DELETE grant on these tables, so the setting cannot help them; UPDATE stays forbidden always.
create or replace function private.reject_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('qs.purge', true) = 'on'
     and current_user in ('postgres', 'supabase_admin', 'service_role') then
    return old;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;
