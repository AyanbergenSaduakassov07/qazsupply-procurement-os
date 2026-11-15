-- M5 Procurement OS: RFQ (versioned, human-approved, human-sent), offers with confirmed numbers,
-- decision records, catalogue entries, analog feedback and consented, k-anonymous price sharing.
-- CONTEXT: RFQ, Offer, Decision record, Catalogue entry.
--
-- Nothing here sends anything: "sent" is a human recording that they sent the RFQ through their
-- own channel (or that the supplier was given portal access). No auto-award: a decision is a
-- named human's append-only record with a reason and the alternatives considered.
-- Supplier users (role `supplier`) see only RFQs they are invited to, and only their own offers.
-- Rule violations raise 23514 `rfq:<reason>`.
-- Down path: drop the tables, functions and the organizations.share_prices column.

-- ---------------------------------------------------------------- organizations
-- Explicit consent to contribute anonymised price points to shared aggregates (k >= 5 orgs).
alter table public.organizations add column share_prices boolean not null default false;
grant update (share_prices) on public.organizations to authenticated;

-- ---------------------------------------------------------------- rfqs
create table public.rfqs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 255),
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'sent', 'collecting', 'closed', 'decided', 'cancelled')),
  current_version integer not null default 1 check (current_version >= 1),
  deadline date,
  weights jsonb not null default '{}',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create index rfqs_org_idx on public.rfqs (org_id, created_at desc);
create index rfqs_created_by_idx on public.rfqs (created_by);

-- Each version is a frozen snapshot: spec text, items, terms. Append-only.
create table public.rfq_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  rfq_id uuid not null,
  version integer not null check (version >= 1),
  spec_text text not null default '' check (length(spec_text) <= 50000),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 200),
  terms jsonb not null default '{}',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default clock_timestamp(),
  unique (rfq_id, version),
  foreign key (rfq_id, org_id) references public.rfqs (id, org_id) on delete cascade
);
create index rfq_versions_org_idx on public.rfq_versions (org_id);
create index rfq_versions_rfq_idx on public.rfq_versions (rfq_id, org_id);
create index rfq_versions_created_by_idx on public.rfq_versions (created_by);

create table public.rfq_approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  rfq_id uuid not null,
  version integer not null,
  approved_by uuid not null default auth.uid() references auth.users (id),
  note text check (length(note) <= 2000),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (rfq_id, org_id) references public.rfqs (id, org_id) on delete cascade
);
create index rfq_approvals_rfq_idx on public.rfq_approvals (rfq_id, org_id, version);
create index rfq_approvals_org_idx on public.rfq_approvals (org_id);
create index rfq_approvals_by_idx on public.rfq_approvals (approved_by);

create table public.rfq_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  rfq_id uuid not null,
  supplier_id uuid not null,
  supplier_user_id uuid references auth.users (id),
  channel text not null check (channel in ('portal', 'email', 'phone', 'other')),
  sent_at timestamptz,
  sent_by uuid references auth.users (id),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  unique (id, org_id),
  unique (rfq_id, supplier_id),
  foreign key (rfq_id, org_id) references public.rfqs (id, org_id) on delete cascade,
  foreign key (supplier_id, org_id) references public.suppliers (id, org_id),
  check (channel <> 'portal' or supplier_user_id is not null)
);
create index rfq_invites_org_idx on public.rfq_invites (org_id);
create index rfq_invites_rfq_idx on public.rfq_invites (rfq_id, org_id);
create index rfq_invites_supplier_idx on public.rfq_invites (supplier_id, org_id);
create index rfq_invites_user_idx on public.rfq_invites (supplier_user_id);
create index rfq_invites_sent_by_idx on public.rfq_invites (sent_by);
create index rfq_invites_created_by_idx on public.rfq_invites (created_by);

-- ---------------------------------------------------------------- offers (append-only)
-- A newer offer from the same invite supersedes the older one; history is kept.
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  rfq_id uuid not null,
  invite_id uuid not null,
  rfq_version integer not null,
  source text not null check (source in ('portal', 'email', 'pdf', 'phone', 'manual')),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  payment_days integer check (payment_days between 0 and 365),
  lead_time_days integer check (lead_time_days between 0 and 730),
  valid_until date,
  incoterms text check (incoterms ~ '^[A-Z]{3}$'),
  lines jsonb not null check (jsonb_typeof(lines) = 'array'),
  entered_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default clock_timestamp(),
  unique (id, org_id),
  foreign key (rfq_id, org_id) references public.rfqs (id, org_id) on delete cascade,
  foreign key (invite_id, org_id) references public.rfq_invites (id, org_id) on delete cascade
);
create index offers_rfq_idx on public.offers (rfq_id, org_id, created_at desc);
create index offers_org_idx on public.offers (org_id);
create index offers_invite_idx on public.offers (invite_id, org_id);
create index offers_entered_by_idx on public.offers (entered_by);

-- Extracted numbers enter comparison only after the supplier (or a named human) confirms them.
create table public.offer_confirmations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  offer_id uuid not null,
  confirmed_by uuid not null default auth.uid() references auth.users (id),
  by_supplier boolean not null,
  note text check (length(note) <= 2000),
  created_at timestamptz not null default clock_timestamp(),
  unique (offer_id),
  foreign key (offer_id, org_id) references public.offers (id, org_id) on delete cascade,
  check (by_supplier or length(trim(coalesce(note, ''))) > 0)
);
create index offer_confirmations_org_idx on public.offer_confirmations (org_id);
create index offer_confirmations_offer_idx on public.offer_confirmations (offer_id, org_id);
create index offer_confirmations_by_idx on public.offer_confirmations (confirmed_by);

-- ---------------------------------------------------------------- decision records (append-only)
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  rfq_id uuid not null,
  offer_id uuid not null,
  reason text not null check (length(trim(reason)) between 10 and 4000),
  alternatives jsonb not null,
  weights jsonb not null,
  decided_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default clock_timestamp(),
  unique (rfq_id),
  foreign key (rfq_id, org_id) references public.rfqs (id, org_id) on delete cascade,
  foreign key (offer_id, org_id) references public.offers (id, org_id)
);
create index decisions_org_idx on public.decisions (org_id);
create index decisions_rfq_idx on public.decisions (rfq_id, org_id);
create index decisions_offer_idx on public.decisions (offer_id, org_id);
create index decisions_by_idx on public.decisions (decided_by);

-- ---------------------------------------------------------------- catalogue
create extension if not exists pg_trgm with schema extensions;

create table public.catalogue_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 255),
  enstru_code text,
  unit text,
  attributes jsonb not null default '{}' check (jsonb_typeof(attributes) = 'object'),
  standards text[] not null default '{}',
  item_id uuid,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (item_id, org_id) references public.items (id, org_id) on delete set null (item_id)
);
create index catalogue_entries_org_idx on public.catalogue_entries (org_id);
create index catalogue_entries_item_idx on public.catalogue_entries (item_id, org_id);
create index catalogue_entries_created_by_idx on public.catalogue_entries (created_by);
-- Same expression as the search (lower + Kazakh letters folded), so the index is used.
create index catalogue_entries_name_trgm on public.catalogue_entries
  using gin ((translate(lower(name), 'ёәғқңөұүһі', 'еагкноуухи')) extensions.gin_trgm_ops);

-- Reviewer accept/reject of a suggested analog: feeds the analog eval set. Append-only.
create table public.analog_feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  entry_id uuid not null,
  analog_id uuid not null,
  accepted boolean not null,
  note text check (length(note) <= 2000),
  reviewer_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (entry_id, org_id) references public.catalogue_entries (id, org_id) on delete cascade,
  foreign key (analog_id, org_id) references public.catalogue_entries (id, org_id) on delete cascade
);
create index analog_feedback_org_idx on public.analog_feedback (org_id);
create index analog_feedback_entry_idx on public.analog_feedback (entry_id, org_id);
create index analog_feedback_analog_idx on public.analog_feedback (analog_id, org_id);
create index analog_feedback_reviewer_idx on public.analog_feedback (reviewer_id);

-- ---------------------------------------------------------------- append-only
create trigger rfq_versions_append_only before update or delete on public.rfq_versions
  for each row execute function private.reject_mutation();
create trigger rfq_approvals_append_only before update or delete on public.rfq_approvals
  for each row execute function private.reject_mutation();
create trigger offers_append_only before update or delete on public.offers
  for each row execute function private.reject_mutation();
create trigger offer_confirmations_append_only before update or delete on public.offer_confirmations
  for each row execute function private.reject_mutation();
create trigger decisions_append_only before update or delete on public.decisions
  for each row execute function private.reject_mutation();
create trigger analog_feedback_append_only before update or delete on public.analog_feedback
  for each row execute function private.reject_mutation();

-- ---------------------------------------------------------------- helpers
create function private.is_buyer(target_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(target_org,
    array['client_admin', 'client_user', 'qazsupply_admin']::public.app_role[]);
$$;
create function private.is_approver(target_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(target_org, array['client_admin', 'qazsupply_admin']::public.app_role[]);
$$;
-- The supplier user invited to an RFQ (portal), for policies on rfqs/versions/offers.
create function private.invited_to(target_rfq uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.rfq_invites i
                 where i.rfq_id = target_rfq and i.supplier_user_id = auth.uid()
                   and i.sent_at is not null);
$$;
create function private.invite_owner(target_invite uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select i.supplier_user_id from public.rfq_invites i where i.id = target_invite;
$$;
create function private.offer_owner(target_offer uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select i.supplier_user_id from public.offers o join public.rfq_invites i on i.id = o.invite_id
  where o.id = target_offer;
$$;
revoke all on function private.is_buyer(uuid), private.is_approver(uuid), private.invited_to(uuid),
  private.invite_owner(uuid), private.offer_owner(uuid) from public;
grant execute on function private.is_buyer(uuid), private.is_approver(uuid),
  private.invited_to(uuid), private.invite_owner(uuid), private.offer_owner(uuid) to authenticated;

-- ---------------------------------------------------------------- state machine
create function private.guard_rfq() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not private.is_buyer(new.org_id) then return new; end if;  -- RLS refuses (42501)
    if new.status <> 'draft' or new.current_version <> 1 then
      raise exception 'rfq:starts_as_draft' using errcode = '23514';
    end if;
    new.created_by := auth.uid();
    perform private.append_audit(new.org_id, 'rfq.created', 'rfqs', new.id, '{}');
    return new;
  end if;
  if new.created_by <> old.created_by then
    raise exception 'rfq:immutable' using errcode = '23514';
  end if;
  if old.status in ('decided', 'cancelled') then
    raise exception 'rfq:closed' using errcode = '23514';
  end if;
  if new.current_version <> old.current_version and current_setting('qs.rfq_new_version', true) is distinct from 'on' then
    raise exception 'rfq:version_changes_only_with_a_new_version' using errcode = '23514';
  end if;
  if new.status is distinct from old.status then
    if old.status = 'draft' and new.status = 'approved' then
      if not exists (select 1 from public.rfq_approvals a
                     where a.rfq_id = new.id and a.version = new.current_version) then
        raise exception 'rfq:approval_required' using errcode = '23514';
      end if;
    elsif old.status = 'approved' and new.status = 'sent' then
      if not exists (select 1 from public.rfq_invites i where i.rfq_id = new.id and i.sent_at is not null) then
        raise exception 'rfq:send_recorded_first' using errcode = '23514';
      end if;
    elsif old.status = 'sent' and new.status = 'collecting' then
      null;  -- first offer arrived
    elsif old.status in ('sent', 'collecting') and new.status = 'closed' then
      null;
    elsif old.status = 'closed' and new.status = 'decided' then
      if not exists (select 1 from public.decisions d where d.rfq_id = new.id) then
        raise exception 'rfq:decision_required' using errcode = '23514';
      end if;
    elsif new.status = 'cancelled' then
      null;
    elsif new.status = 'draft' and current_setting('qs.rfq_new_version', true) = 'on' then
      null;  -- a new version re-opens the draft and needs a fresh approval
    else
      raise exception 'rfq:transition_not_allowed' using errcode = '23514';
    end if;
    perform private.append_audit(new.org_id, 'rfq.' || new.status, 'rfqs', new.id,
      jsonb_build_object('from', old.status, 'version', new.current_version));
  elsif new.weights is distinct from old.weights then
    perform private.append_audit(new.org_id, 'rfq.weights_changed', 'rfqs', new.id, new.weights);
  end if;
  return new;
end;
$$;
create trigger rfqs_guard before insert or update on public.rfqs
  for each row execute function private.guard_rfq();

-- A new version: only while draft/approved; bumps the RFQ to that version and back to draft.
create function private.on_rfq_version() returns trigger
language plpgsql set search_path = '' as $$
declare
  r public.rfqs;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  select * into r from public.rfqs where id = new.rfq_id;
  if r.id is null or not private.is_buyer(new.org_id) then return new; end if;
  new.created_by := auth.uid();
  if new.version = 1 and r.current_version = 1
     and not exists (select 1 from public.rfq_versions v where v.rfq_id = new.rfq_id) then
    return new;
  end if;
  if r.status not in ('draft', 'approved') then
    raise exception 'rfq:locked_after_send' using errcode = '23514';
  end if;
  if new.version <> r.current_version + 1 then
    raise exception 'rfq:version_must_be_next' using errcode = '23514';
  end if;
  perform set_config('qs.rfq_new_version', 'on', true);
  update public.rfqs set current_version = new.version, status = 'draft' where id = new.rfq_id;
  perform set_config('qs.rfq_new_version', 'off', true);
  return new;
end;
$$;
create trigger rfq_versions_bump before insert on public.rfq_versions
  for each row execute function private.on_rfq_version();

create function private.guard_rfq_approval() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' or not private.is_approver(new.org_id) then
    return new;
  end if;
  new.approved_by := auth.uid();
  -- Two-person rule (organizations.four_eyes, M3): whoever drafted the RFQ cannot approve it.
  if exists (select 1 from public.organizations o join public.rfqs r on r.org_id = o.id
             where r.id = new.rfq_id and o.four_eyes and r.created_by = auth.uid()) then
    raise exception 'rfq:four_eyes_creator_cannot_approve' using errcode = '23514';
  end if;
  if not exists (select 1 from public.rfqs r where r.id = new.rfq_id
                 and r.status = 'draft' and r.current_version = new.version) then
    raise exception 'rfq:approve_the_current_draft' using errcode = '23514';
  end if;
  if not exists (select 1 from public.rfq_versions v where v.rfq_id = new.rfq_id
                 and v.version = new.version) then
    raise exception 'rfq:no_such_version' using errcode = '23514';
  end if;
  perform private.append_audit(new.org_id, 'rfq.approval', 'rfqs', new.rfq_id,
    jsonb_build_object('version', new.version));
  return new;
end;
$$;
create trigger rfq_approvals_guard before insert on public.rfq_approvals
  for each row execute function private.guard_rfq_approval();

-- Invites: added in draft/approved; marking `sent_at` is a human recording that they sent it,
-- allowed only once the current version is approved.
create function private.guard_rfq_invite() returns trigger
language plpgsql set search_path = '' as $$
declare
  st text;
begin
  if current_user <> 'authenticated' or not private.is_buyer(new.org_id) then
    return new;
  end if;
  select status into st from public.rfqs where id = new.rfq_id;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.sent_at := null;
    new.sent_by := null;
    if st not in ('draft', 'approved', 'sent', 'collecting') then
      raise exception 'rfq:closed' using errcode = '23514';
    end if;
    if new.supplier_user_id is not null
       and not private.is_supplier_member(new.org_id, new.supplier_user_id) then
      raise exception 'rfq:not_a_supplier_member' using errcode = '23514';
    end if;
    return new;
  end if;
  -- Who an invite reaches is fixed at creation (supplier member checked then): re-pointing it
  -- would hand the RFQ and the invite's offers to another user (code review 2026-10-13).
  if new.rfq_id <> old.rfq_id or new.supplier_id <> old.supplier_id
     or new.supplier_user_id is distinct from old.supplier_user_id or new.channel <> old.channel then
    raise exception 'rfq:immutable' using errcode = '23514';
  end if;
  if new.sent_at is distinct from old.sent_at then
    if old.sent_at is not null or new.sent_at is null then
      raise exception 'rfq:sent_once' using errcode = '23514';
    end if;
    if st not in ('approved', 'sent', 'collecting') then
      raise exception 'rfq:approval_required' using errcode = '23514';
    end if;
    new.sent_at := now();
    new.sent_by := auth.uid();
    perform private.append_audit(new.org_id, 'rfq.invite_sent', 'rfq_invites', new.id,
      jsonb_build_object('rfq_id', new.rfq_id, 'channel', new.channel));
  end if;
  return new;
end;
$$;
create trigger rfq_invites_guard before insert or update on public.rfq_invites
  for each row execute function private.guard_rfq_invite();

-- Offers: only on a sent RFQ, for the version that was sent; a portal offer by the invited
-- supplier is confirmed by that supplier at once; any other offer waits for confirmation.
create function private.guard_offer() returns trigger
language plpgsql set search_path = '' as $$
declare
  r public.rfqs;
  owner uuid;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  owner := private.invite_owner(new.invite_id);
  if not (private.is_buyer(new.org_id) or coalesce(owner = auth.uid(), false)) then
    return new;  -- RLS refuses
  end if;
  select * into r from public.rfqs where id = new.rfq_id;
  if r.status not in ('sent', 'collecting') then
    raise exception 'rfq:not_collecting' using errcode = '23514';
  end if;
  if not exists (select 1 from public.rfq_invites i where i.id = new.invite_id
                 and i.rfq_id = new.rfq_id and i.sent_at is not null) then
    raise exception 'rfq:invite_not_sent' using errcode = '23514';
  end if;
  new.entered_by := auth.uid();
  new.rfq_version := r.current_version;
  if coalesce(owner = auth.uid(), false) then
    new.source := 'portal';
  elsif new.source = 'portal' then
    raise exception 'rfq:portal_is_the_supplier' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger offers_guard before insert on public.offers
  for each row execute function private.guard_offer();

create function private.after_offer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.source = 'portal' then
    insert into public.offer_confirmations (org_id, offer_id, confirmed_by, by_supplier)
    values (new.org_id, new.id, new.entered_by, true);
  end if;
  update public.rfqs set status = 'collecting' where id = new.rfq_id and status = 'sent';
  if auth.uid() is not null then  -- seeds and migrations run without a user
    perform private.append_audit(new.org_id, 'rfq.offer_received', 'offers', new.id,
      jsonb_build_object('rfq_id', new.rfq_id, 'source', new.source));
  end if;
  return new;
end;
$$;
revoke all on function private.after_offer() from public;
create trigger offers_after after insert on public.offers
  for each row execute function private.after_offer();

create function private.guard_offer_confirmation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if coalesce(private.offer_owner(new.offer_id) = auth.uid(), false) then
    new.by_supplier := true;
  elsif private.is_buyer(new.org_id) then
    new.by_supplier := false;  -- a named buyer confirms (phone, signed letter): note required
  else
    return new;  -- RLS refuses
  end if;
  new.confirmed_by := auth.uid();
  perform private.append_audit(new.org_id, 'rfq.offer_confirmed', 'offers', new.offer_id,
    jsonb_build_object('by_supplier', new.by_supplier));
  return new;
end;
$$;
create trigger offer_confirmations_guard before insert on public.offer_confirmations
  for each row execute function private.guard_offer_confirmation();

create function private.guard_decision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' or not private.is_approver(new.org_id) then
    return new;
  end if;
  new.decided_by := auth.uid();
  -- Two-person rule: the approver of the sent version cannot also award it.
  if exists (select 1 from public.organizations o where o.id = new.org_id and o.four_eyes)
     and exists (select 1 from public.rfq_approvals a join public.rfqs r on r.id = a.rfq_id
                 where a.rfq_id = new.rfq_id and a.version = r.current_version
                   and a.approved_by = auth.uid()) then
    raise exception 'rfq:four_eyes_approver_cannot_award' using errcode = '23514';
  end if;
  if not exists (select 1 from public.rfqs r where r.id = new.rfq_id and r.status = 'closed') then
    raise exception 'rfq:close_before_deciding' using errcode = '23514';
  end if;
  if not exists (select 1 from public.offers o
                 join public.offer_confirmations c on c.offer_id = o.id
                 where o.id = new.offer_id and o.rfq_id = new.rfq_id) then
    raise exception 'rfq:offer_not_confirmed' using errcode = '23514';
  end if;
  perform private.append_audit(new.org_id, 'rfq.decision', 'decisions', new.id,
    jsonb_build_object('rfq_id', new.rfq_id, 'offer_id', new.offer_id));
  return new;
end;
$$;
create trigger decisions_guard before insert on public.decisions
  for each row execute function private.guard_decision();

-- ---------------------------------------------------------------- shared price aggregate
-- Median unit price (KZT) for one ЕНС ТРУ code across organizations that consented, returned
-- only when at least k = 5 distinct organizations contribute and the caller's org consented.
create function private.shared_price_stats(target_org uuid, code text)
returns table (orgs integer, points integer, median_kzt numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  k constant integer := 5;
begin
  if not private.is_member(target_org) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = target_org and o.share_prices) then
    return;  -- no consent, no access to others' data
  end if;
  return query
    with pts as (
      select pl.org_id, pl.unit_price_kzt from public.purchase_lines pl
      join public.items i on i.id = pl.item_id
      join public.organizations o on o.id = pl.org_id and o.share_prices
      where i.enstru_code = code and pl.unit_price_kzt is not null
    )
    select count(distinct org_id)::int, count(*)::int,
           percentile_disc(0.5) within group (order by unit_price_kzt)
    from pts having count(distinct org_id) >= k;
end;
$$;
revoke all on function private.shared_price_stats(uuid, text) from public;
grant execute on function private.shared_price_stats(uuid, text) to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.rfqs enable row level security;
alter table public.rfq_versions enable row level security;
alter table public.rfq_approvals enable row level security;
alter table public.rfq_invites enable row level security;
alter table public.offers enable row level security;
alter table public.offer_confirmations enable row level security;
alter table public.decisions enable row level security;
alter table public.catalogue_entries enable row level security;
alter table public.analog_feedback enable row level security;

create policy rfqs_select on public.rfqs for select to authenticated
  using ((select private.is_reader(org_id)) or (select private.invited_to(id)));
create policy rfqs_insert on public.rfqs for insert to authenticated
  with check ((select private.is_buyer(org_id)));
create policy rfqs_update on public.rfqs for update to authenticated
  using ((select private.is_buyer(org_id))) with check ((select private.is_buyer(org_id)));

create policy rfq_versions_select on public.rfq_versions for select to authenticated
  using ((select private.is_reader(org_id)) or (select private.invited_to(rfq_id)));
create policy rfq_versions_insert on public.rfq_versions for insert to authenticated
  with check ((select private.is_buyer(org_id)));

create policy rfq_approvals_select on public.rfq_approvals for select to authenticated
  using ((select private.is_reader(org_id)));
create policy rfq_approvals_insert on public.rfq_approvals for insert to authenticated
  with check ((select private.is_approver(org_id)) and approved_by = (select auth.uid()));

create policy rfq_invites_select on public.rfq_invites for select to authenticated
  using ((select private.is_reader(org_id)) or supplier_user_id = (select auth.uid()));
create policy rfq_invites_insert on public.rfq_invites for insert to authenticated
  with check ((select private.is_buyer(org_id)));
create policy rfq_invites_update on public.rfq_invites for update to authenticated
  using ((select private.is_buyer(org_id))) with check ((select private.is_buyer(org_id)));

-- A supplier sees only its own offers; buyers see all offers on their RFQs.
create policy offers_select on public.offers for select to authenticated
  using ((select private.is_reader(org_id)) or (select private.invite_owner(invite_id)) = (select auth.uid()));
create policy offers_insert on public.offers for insert to authenticated
  with check ((select private.is_buyer(org_id))
              or (select private.invite_owner(invite_id)) = (select auth.uid()));

create policy offer_confirmations_select on public.offer_confirmations for select to authenticated
  using ((select private.is_reader(org_id)) or (select private.offer_owner(offer_id)) = (select auth.uid()));
create policy offer_confirmations_insert on public.offer_confirmations for insert to authenticated
  with check (((select private.is_buyer(org_id)) or (select private.offer_owner(offer_id)) = (select auth.uid()))
              and confirmed_by = (select auth.uid()));

create policy decisions_select on public.decisions for select to authenticated
  using ((select private.is_reader(org_id)));
create policy decisions_insert on public.decisions for insert to authenticated
  with check ((select private.is_approver(org_id)) and decided_by = (select auth.uid()));

create policy catalogue_entries_select on public.catalogue_entries for select to authenticated
  using ((select private.is_reader(org_id)));
create policy catalogue_entries_insert on public.catalogue_entries for insert to authenticated
  with check ((select private.is_buyer(org_id)));
create policy catalogue_entries_update on public.catalogue_entries for update to authenticated
  using ((select private.is_buyer(org_id))) with check ((select private.is_buyer(org_id)));

create policy analog_feedback_select on public.analog_feedback for select to authenticated
  using ((select private.is_reader(org_id)));
create policy analog_feedback_insert on public.analog_feedback for insert to authenticated
  with check ((select private.is_reader(org_id)) and reviewer_id = (select auth.uid()));

revoke all on public.rfqs, public.rfq_versions, public.rfq_approvals, public.rfq_invites,
  public.offers, public.offer_confirmations, public.decisions, public.catalogue_entries,
  public.analog_feedback from anon, authenticated;
grant select, insert on public.rfqs, public.rfq_versions, public.rfq_approvals, public.rfq_invites,
  public.offers, public.offer_confirmations, public.decisions, public.catalogue_entries,
  public.analog_feedback to authenticated;
grant update (title, status, deadline, weights, current_version) on public.rfqs to authenticated;
grant update (sent_at) on public.rfq_invites to authenticated;
grant update (name, enstru_code, unit, attributes, standards, item_id) on public.catalogue_entries
  to authenticated;
