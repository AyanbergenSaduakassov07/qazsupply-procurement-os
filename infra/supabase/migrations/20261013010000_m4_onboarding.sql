-- M4 supplier onboarding: invite -> details + documents (supplier) -> submit -> human check.
-- States: invited -> in_progress -> submitted -> approved | rejected, and submitted -> in_progress
-- (returned to the supplier with a note). Enforced here; the API and UI repeat it.
-- The supplier is a `supplier` member of the org and sees only its own case; buyers (client
-- admins) and QazSupply staff invite and decide. Rule violations raise 23514 `onboarding:<reason>`.
-- Documents are untrusted input: type checked by magic bytes in the API, size capped here,
-- never rendered inline (downloaded as attachments). No OCR in M4: the supplier types the key
-- fields and confirms them (`fields_confirmed`), recorded as such.
-- ponytail: document bytes live in Postgres (bytea, <= 5 MB); move to object storage when
-- volume grows. Down path: drop the two tables, the functions and triggers below.

create table public.onboarding_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  supplier_id uuid,
  supplier_user_id uuid not null references auth.users (id),
  status text not null default 'invited'
    check (status in ('invited', 'in_progress', 'submitted', 'approved', 'rejected')),
  legal_name text check (length(legal_name) <= 255),
  bin text check (bin ~ '^[0-9]{12}$'),
  contact_name text check (length(contact_name) <= 255),
  contact_phone text check (contact_phone ~ '^\+?[0-9 ()-]{6,20}$'),
  confirmed boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  decision_note text check (length(decision_note) <= 2000),
  unique (id, org_id),
  foreign key (supplier_id, org_id) references public.suppliers (id, org_id)
);
create index onboarding_cases_org_idx on public.onboarding_cases (org_id, created_at);
create index onboarding_cases_user_idx on public.onboarding_cases (supplier_user_id);
create index onboarding_cases_supplier_idx on public.onboarding_cases (supplier_id, org_id);
create index onboarding_cases_created_by_idx on public.onboarding_cases (created_by);
create index onboarding_cases_decided_by_idx on public.onboarding_cases (decided_by);

create table public.onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null,
  kind text not null check (kind in ('registration_certificate', 'charter', 'bank_letter', 'other')),
  file_name text not null check (length(file_name) between 1 and 255),
  content_type text not null check (content_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  content bytea not null,
  doc_number text check (length(doc_number) <= 100),
  issued_on date,
  fields_confirmed boolean not null default false,
  uploaded_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (case_id, org_id) references public.onboarding_cases (id, org_id) on delete cascade,
  check (octet_length(content) = size_bytes)
);
create index onboarding_documents_case_idx on public.onboarding_documents (case_id, org_id);
create index onboarding_documents_org_idx on public.onboarding_documents (org_id);
create index onboarding_documents_uploaded_by_idx on public.onboarding_documents (uploaded_by);
create trigger onboarding_documents_append_only before update or delete on public.onboarding_documents
  for each row execute function private.reject_mutation();

-- ---------------------------------------------------------------- helpers
create function private.is_supplier_member(target_org uuid, target_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.org_id = target_org and m.user_id = target_user and m.role = 'supplier');
$$;
revoke all on function private.is_supplier_member(uuid, uuid) from public;
grant execute on function private.is_supplier_member(uuid, uuid) to authenticated;

-- Buyers invite by email (onboarding, RFQs); returns the user only if that email is a supplier
-- member of the org and the caller is a buyer there (never a general email lookup).
create function private.supplier_member_by_email(target_org uuid, target_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.user_id from public.memberships m join auth.users u on u.id = m.user_id
  where m.org_id = target_org and m.role = 'supplier'
    and lower(u.email) = lower(btrim(target_email))
    and (private.is_admin(target_org) or private.is_staff(target_org)
         or private.has_role(target_org, array['client_user']::public.app_role[]));
$$;
revoke all on function private.supplier_member_by_email(uuid, text) from public;
grant execute on function private.supplier_member_by_email(uuid, text) to authenticated;

create function private.onboarding_case_owner(target_case uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.supplier_user_id from public.onboarding_cases c where c.id = target_case;
$$;
revoke all on function private.onboarding_case_owner(uuid) from public;
grant execute on function private.onboarding_case_owner(uuid) to authenticated;

-- ---------------------------------------------------------------- state machine
create function private.guard_onboarding() returns trigger
language plpgsql set search_path = '' as $$
declare
  me uuid := auth.uid();
  buyer boolean;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  buyer := private.is_admin(new.org_id) or private.is_staff(new.org_id);
  if tg_op = 'INSERT' then
    -- Non-buyers are refused by RLS (42501); rules below are for buyers.
    if not buyer then return new; end if;
    if new.status <> 'invited' or new.decided_by is not null or new.submitted_at is not null then
      raise exception 'onboarding:cases_start_invited' using errcode = '23514';
    end if;
    if not private.is_supplier_member(new.org_id, new.supplier_user_id) then
      raise exception 'onboarding:not_a_supplier_member' using errcode = '23514';
    end if;
    new.created_by := me;
    perform private.append_audit(new.org_id, 'onboarding.invited', 'onboarding_cases', new.id,
      jsonb_build_object('supplier_id', new.supplier_id));
    return new;
  end if;

  if new.org_id <> old.org_id or new.supplier_user_id <> old.supplier_user_id
     or new.created_by <> old.created_by or new.supplier_id is distinct from old.supplier_id then
    raise exception 'onboarding:immutable' using errcode = '23514';
  end if;

  if me = old.supplier_user_id and not buyer then
    if old.status not in ('invited', 'in_progress') then
      raise exception 'onboarding:locked_for_supplier' using errcode = '23514';
    end if;
    if new.decided_by is distinct from old.decided_by or new.decided_at is distinct from old.decided_at
       or new.decision_note is distinct from old.decision_note then
      raise exception 'onboarding:supplier_cannot_decide' using errcode = '23514';
    end if;
    if new.status = 'invited' and old.status = 'in_progress' then
      raise exception 'onboarding:transition_not_allowed' using errcode = '23514';
    elsif new.status = 'submitted' then
      if not new.confirmed or new.legal_name is null or new.bin is null then
        raise exception 'onboarding:details_incomplete' using errcode = '23514';
      end if;
      if not exists (select 1 from public.onboarding_documents d
                     where d.case_id = new.id and d.fields_confirmed) then
        raise exception 'onboarding:document_required' using errcode = '23514';
      end if;
      new.submitted_at := now();
    elsif new.status not in ('invited', 'in_progress') then
      raise exception 'onboarding:transition_not_allowed' using errcode = '23514';
    end if;
  elsif buyer then
    if new.legal_name is distinct from old.legal_name or new.bin is distinct from old.bin
       or new.contact_name is distinct from old.contact_name
       or new.contact_phone is distinct from old.contact_phone
       or new.confirmed is distinct from old.confirmed then
      raise exception 'onboarding:buyer_cannot_edit_supplier_data' using errcode = '23514';
    end if;
    if new.status is distinct from old.status then
      if old.status <> 'submitted' or new.status not in ('approved', 'rejected', 'in_progress') then
        raise exception 'onboarding:transition_not_allowed' using errcode = '23514';
      end if;
      if new.status in ('rejected', 'in_progress') and coalesce(btrim(new.decision_note), '') = '' then
        raise exception 'onboarding:note_required' using errcode = '23514';
      end if;
      new.decided_by := me;
      new.decided_at := now();
      if new.status = 'in_progress' then new.submitted_at := null; end if;
    end if;
  else
    raise exception 'onboarding:not_allowed' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    perform private.append_audit(new.org_id, 'onboarding.' || new.status, 'onboarding_cases', new.id,
      jsonb_build_object('from', old.status));
  end if;
  return new;
end;
$$;
create trigger onboarding_cases_guard before insert or update on public.onboarding_cases
  for each row execute function private.guard_onboarding();

create function private.guard_onboarding_document() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and private.onboarding_case_owner(new.case_id) = auth.uid()
     and not exists (select 1 from public.onboarding_cases c
                     where c.id = new.case_id and c.status in ('invited', 'in_progress')) then
    raise exception 'onboarding:locked_for_supplier' using errcode = '23514';
  end if;
  if current_user = 'authenticated' then
    new.uploaded_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger onboarding_documents_guard before insert on public.onboarding_documents
  for each row execute function private.guard_onboarding_document();

-- ---------------------------------------------------------------- RLS
alter table public.onboarding_cases enable row level security;
alter table public.onboarding_documents enable row level security;

create policy onboarding_cases_select on public.onboarding_cases for select to authenticated
  using ((select private.is_reader(org_id)) or supplier_user_id = (select auth.uid()));
create policy onboarding_cases_insert on public.onboarding_cases for insert to authenticated
  with check ((select private.is_admin(org_id)) or (select private.is_staff(org_id)));
create policy onboarding_cases_update on public.onboarding_cases for update to authenticated
  using ((select private.is_admin(org_id)) or (select private.is_staff(org_id))
         or supplier_user_id = (select auth.uid()))
  with check ((select private.is_admin(org_id)) or (select private.is_staff(org_id))
              or supplier_user_id = (select auth.uid()));

create policy onboarding_documents_select on public.onboarding_documents for select to authenticated
  using ((select private.is_reader(org_id))
         or (select private.onboarding_case_owner(case_id)) = (select auth.uid()));
create policy onboarding_documents_insert on public.onboarding_documents for insert to authenticated
  with check ((select private.onboarding_case_owner(case_id)) = (select auth.uid())
              and (select private.is_supplier_member(org_id, auth.uid())));

revoke all on public.onboarding_cases, public.onboarding_documents from anon, authenticated;
grant select, insert on public.onboarding_cases, public.onboarding_documents to authenticated;
grant update (status, legal_name, bin, contact_name, contact_phone, confirmed, decision_note)
  on public.onboarding_cases to authenticated;
