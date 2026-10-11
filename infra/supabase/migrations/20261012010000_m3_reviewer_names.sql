-- M3 report surface: "who reviewed" on every figure needs a reviewer's display name.
-- There is no profile table; the name is the reviewer's own `full_name` auth metadata.
-- The function answers only for users who hold a staff role in an organization the caller
-- belongs to, so it cannot be used to look up arbitrary users. Emails are never returned.
-- Down path: drop function private.staff_name(uuid).

create function private.staff_name(target_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select nullif(btrim(u.raw_user_meta_data ->> 'full_name'), '')
  from auth.users u
  where u.id = target_user
    and exists (
      select 1 from public.memberships staff
      where staff.user_id = target_user
        and staff.role in ('reviewer', 'qazsupply_admin')
        and private.is_member(staff.org_id)
    );
$$;
revoke all on function private.staff_name(uuid) from public;
grant execute on function private.staff_name(uuid) to authenticated;
