-- Audit chain order = id order, also under concurrent writes.
-- Bug (found 2026-10-12 once uploads ran concurrently): the identity id was drawn before the
-- per-org chain lock, so a later-numbered insert could take the lock first. The earlier-numbered
-- row then chained after it and verify_audit_chain (which walks by id) reported a break.
-- Fix: draw the id and timestamp after taking the lock. Ids stay unique; sequence gaps are fine.
-- Down path: restore the M1 definition of private.audit_chain().
create or replace function private.audit_chain() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text, 0));
  new.id := nextval(pg_get_serial_sequence('public.audit_log', 'id'));
  new.created_at := clock_timestamp();
  select a.hash into new.prev_hash from public.audit_log a
    where a.org_id = new.org_id order by a.id desc limit 1;
  new.prev_hash := coalesce(new.prev_hash, repeat('0', 64));
  new.hash := private.audit_row_hash(new.prev_hash, new);
  return new;
end;
$$;
