"""The audit hash chain stays verifiable when an earlier-numbered insert is overtaken."""

import threading
import time

import psycopg
import pytest

pytestmark = pytest.mark.integration
DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
ORG_B = "10000000-0000-4000-a000-00000000000b"
GATE = 4242  # advisory lock key used only by this test


def _insert(action: str) -> None:
    with psycopg.connect(DB) as conn:
        conn.execute(
            "insert into public.audit_log (org_id, action, entity, prev_hash, hash)"
            " values (%s, %s, 'none', '', '')",
            (ORG_B, action),
        )


def test_chain_verifies_when_a_later_insert_takes_the_lock_first() -> None:
    # A test-only trigger that fires before the chain trigger (alphabetical order) parks
    # `test.parked` until we release GATE: by then that row has already drawn its default id.
    setup = [
        """create function private.test_gate() returns trigger language plpgsql as $$
           begin
             if new.action = 'test.parked' then perform pg_advisory_lock(4242); end if;
             return new;
           end $$""",
        "create trigger audit_log_a_test_gate before insert on public.audit_log"
        " for each row execute function private.test_gate()",
    ]
    with psycopg.connect(DB, autocommit=True) as admin:
        for sql in setup:
            admin.execute(sql)
        try:
            admin.execute("select pg_advisory_lock(%s)", (GATE,))
            parked = threading.Thread(target=_insert, args=("test.parked",))
            parked.start()
            time.sleep(0.5)  # parked insert holds a lower id and waits on GATE
            _insert("test.overtook")  # higher id, takes the chain lock first, commits
            admin.execute("select pg_advisory_unlock(%s)", (GATE,))
            parked.join(timeout=10)
            assert not parked.is_alive()
            broken = admin.execute("select private.verify_audit_chain(%s)", (ORG_B,)).fetchone()
            assert broken == (None,), f"chain breaks at audit_log.id {broken}"
        finally:
            admin.execute("drop trigger if exists audit_log_a_test_gate on public.audit_log")
            admin.execute("drop function if exists private.test_gate()")
            admin.execute("select pg_advisory_unlock_all()")
