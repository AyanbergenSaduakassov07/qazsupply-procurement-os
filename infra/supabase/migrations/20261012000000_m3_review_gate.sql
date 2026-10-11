-- M3 review gate: a report reaches a client only through draft -> in_review -> approved -> released,
-- with a human decision on every finding and an audit entry on every step (CONTEXT: Report, Review).
-- Enforced here (DB), again in the API and the UI; each layer has its own tests.
--
-- Guards apply to the `authenticated` role (every signed-in user, also through the API).
-- Privileged roles (postgres, service_role) bypass them by design, like RLS: seeds, migrations
-- and test fixtures run as those roles.
-- Rule violations raise check_violation (23514) with a message `review_gate:<reason>`, which the
-- API maps to 409. Attempts the caller has no right to make raise 42501, like RLS.
-- Down path: drop the triggers and functions below, the added columns, and restore the M1
-- definitions of private.evidence_visible and the findings/reviews select policies.

-- ---------------------------------------------------------------- organizations
-- ask_enabled: the client opts in to Ask (sends finding-level tool results to a model provider).
-- four_eyes: approver must differ from the analysis runner, and the releaser from the approver.
alter table public.organizations
  add column ask_enabled boolean not null default false,
  add column four_eyes boolean not null default false;
grant update (ask_enabled, four_eyes) on public.organizations to authenticated;

-- A client admin may not switch off QazSupply's own review control.
create function private.guard_org_settings() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated'
     and new.four_eyes is distinct from old.four_eyes
     and not private.has_role(new.id, array['qazsupply_admin']::public.app_role[]) then
    raise exception 'only a QazSupply admin changes four_eyes' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger organizations_settings_guard before update on public.organizations
  for each row execute function private.guard_org_settings();

-- ---------------------------------------------------------------- reports
alter table public.reports
  add column created_by uuid references auth.users (id),
  add column submitted_at timestamptz;
create index reports_created_by_idx on public.reports (created_by);

create function private.latest_report_approver(target_report uuid) returns uuid
language sql stable set search_path = '' as $$
  select r.reviewer_id from public.reviews r
  where r.report_id = target_report and r.finding_id is null and r.decision = 'approve'
  order by r.created_at desc, r.id desc limit 1;
$$;

create function private.undecided_findings(target_report uuid) returns integer
language sql stable set search_path = '' as $$
  select count(*)::int from public.findings f
  where f.report_id = target_report
    and not exists (select 1 from public.reviews r where r.finding_id = f.id);
$$;

create function private.guard_report() returns trigger
language plpgsql set search_path = '' as $$
declare
  me uuid := auth.uid();
  four_eyes boolean;
  last_finding_review timestamptz;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.released_at is not null or new.released_by is not null then
      raise exception 'review_gate:reports_start_as_draft' using errcode = '23514';
    end if;
    new.created_by := me;
    new.submitted_at := null;
    return new;
  end if;

  if old.status in ('released', 'superseded', 'rejected')
     and not (old.status = 'released' and new.status = 'superseded') then
    raise exception 'review_gate:report_closed' using errcode = '23514';
  end if;
  new.created_by := old.created_by;
  select o.four_eyes into four_eyes from public.organizations o where o.id = new.org_id;

  if new.status is distinct from old.status then
    if old.status = 'draft' and new.status = 'in_review' then
      new.submitted_at := now();
    elsif old.status = 'in_review' and new.status = 'draft' then
      new.submitted_at := null;
    elsif old.status = 'in_review' and new.status = 'approved' then
      if private.undecided_findings(new.id) > 0 then
        raise exception 'review_gate:undecided_findings' using errcode = '23514';
      end if;
      select max(r.created_at) into last_finding_review from public.reviews r
        where r.report_id = new.id and r.finding_id is not null;
      if not exists (
        select 1 from public.reviews r
        where r.report_id = new.id and r.finding_id is null and r.decision = 'approve'
          and r.reviewer_id = me and r.created_at >= coalesce(last_finding_review, '-infinity')
      ) then
        raise exception 'review_gate:approval_review_required' using errcode = '23514';
      end if;
      if four_eyes and old.created_by = me then
        raise exception 'review_gate:four_eyes_runner_cannot_approve' using errcode = '23514';
      end if;
    elsif old.status = 'in_review' and new.status = 'rejected' then
      if not exists (
        select 1 from public.reviews r
        where r.report_id = new.id and r.finding_id is null and r.decision = 'reject'
          and r.reviewer_id = me
      ) then
        raise exception 'review_gate:rejection_review_required' using errcode = '23514';
      end if;
    elsif old.status = 'approved' and new.status = 'in_review' then
      null; -- reopened: a fresh approval is needed
    elsif old.status = 'approved' and new.status = 'released' then
      if four_eyes and private.latest_report_approver(new.id) = me then
        raise exception 'review_gate:four_eyes_approver_cannot_release' using errcode = '23514';
      end if;
      new.released_at := now();
      new.released_by := me;
    elsif old.status = 'released' and new.status = 'superseded' then
      null;
    else
      raise exception 'review_gate:transition_not_allowed' using errcode = '23514';
    end if;
    perform private.append_audit(new.org_id, 'report.' || new.status::text, 'reports', new.id,
      jsonb_build_object('from', old.status::text));
  elsif new.title is distinct from old.title and old.status not in ('draft', 'in_review') then
    raise exception 'review_gate:report_frozen' using errcode = '23514';
  end if;

  -- Release fields are written only by the release step.
  if new.status not in ('released', 'superseded') then
    new.released_at := null;
    new.released_by := null;
  elsif old.status in ('released', 'superseded') then
    new.released_at := old.released_at;
    new.released_by := old.released_by;
  end if;
  return new;
end;
$$;
create trigger reports_review_gate before insert or update on public.reports
  for each row execute function private.guard_report();

-- ---------------------------------------------------------------- findings
-- Findings are frozen once their report leaves draft (the reviewer judges a fixed set).
create function private.guard_finding() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.report_id is not null and not exists (
    select 1 from public.reports r where r.id = new.report_id and r.status = 'draft'
  ) then
    raise exception 'review_gate:findings_frozen' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger findings_review_gate before insert or update on public.findings
  for each row execute function private.guard_finding();

-- ---------------------------------------------------------------- reviews
create function private.guard_review() returns trigger
language plpgsql set search_path = '' as $$
declare
  report_status public.report_status;
begin
  -- Non-staff and forged signatures are left to RLS (42501); rules below are for reviewers.
  if current_user <> 'authenticated' or not private.is_staff(new.org_id)
     or new.reviewer_id is distinct from auth.uid() then
    return new;
  end if;
  new.created_at := now();
  select r.status into report_status from public.reports r where r.id = new.report_id;
  if report_status is distinct from 'in_review' then
    raise exception 'review_gate:report_not_in_review' using errcode = '23514';
  end if;
  if new.finding_id is not null then
    if not exists (select 1 from public.findings f
                   where f.id = new.finding_id and f.report_id = new.report_id) then
      raise exception 'review_gate:finding_not_in_report' using errcode = '23514';
    end if;
    if new.decision in ('edit', 'reject') and coalesce(btrim(new.note), '') = '' then
      raise exception 'review_gate:note_required' using errcode = '23514';
    end if;
  else
    if new.decision = 'edit' then
      raise exception 'review_gate:report_decision_is_approve_or_reject' using errcode = '23514';
    end if;
    if new.decision = 'reject' and coalesce(btrim(new.note), '') = '' then
      raise exception 'review_gate:note_required' using errcode = '23514';
    end if;
    if new.decision = 'approve' and private.undecided_findings(new.report_id) > 0 then
      raise exception 'review_gate:undecided_findings' using errcode = '23514';
    end if;
  end if;
  perform private.append_audit(new.org_id, 'review.' || new.decision::text, 'reviews', new.id,
    jsonb_build_object('report_id', new.report_id, 'finding_id', new.finding_id));
  return new;
end;
$$;
create trigger reviews_review_gate before insert on public.reviews
  for each row execute function private.guard_review();

-- ---------------------------------------------------------------- client visibility
-- A client sees a finding only in a released report and only if its latest decision is not
-- `reject`. Every finding of an approved report has a decision (guard above).
create function private.finding_rejected(target_finding uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select v.decision = 'reject' from public.reviews v
                   where v.finding_id = target_finding
                   order by v.created_at desc, v.id desc limit 1), false);
$$;
-- For existing rows (evidence, reviews). The findings policy below works on the row's own columns,
-- because a row being inserted is not yet visible to a lookup by id (INSERT ... RETURNING).
create function private.finding_visible(target_finding uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.findings f
    where f.id = target_finding
      and (private.is_staff(f.org_id)
           or (private.report_visible(f.report_id) and not private.finding_rejected(f.id)))
  );
$$;
revoke all on function private.finding_rejected(uuid), private.finding_visible(uuid) from public;
grant execute on function private.finding_rejected(uuid), private.finding_visible(uuid)
  to authenticated;

create or replace function private.evidence_visible(target_evidence uuid, target_org uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_staff(target_org) or exists (
    select 1 from public.finding_evidence fe
    where fe.evidence_id = target_evidence and private.finding_visible(fe.finding_id)
  );
$$;

drop policy findings_select on public.findings;
create policy findings_select on public.findings for select to authenticated
  using ((select private.is_staff(org_id))
         or ((select private.report_visible(report_id)) and not private.finding_rejected(id)));

drop policy reviews_select on public.reviews;
create policy reviews_select on public.reviews for select to authenticated
  using ((select private.report_visible(report_id))
         and (finding_id is null or (select private.finding_visible(finding_id))));
