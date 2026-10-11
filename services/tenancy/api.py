"""Tenancy module: who am I, which orgs, audit log. RLS does the filtering."""

import json
from typing import Any
from uuid import UUID

from services.gateway.db import UserConn


def memberships(conn: UserConn, user_id: UUID) -> list[dict[str, Any]]:
    return conn.execute(
        """select o.id as org_id, o.name as org_name, m.role::text as role
           from public.memberships m join public.organizations o on o.id = m.org_id
           where m.user_id = %s order by o.name""",
        (user_id,),
    ).fetchall()


def is_member(conn: UserConn, org_id: UUID) -> bool:
    row = conn.execute("select private.is_member(%s) as ok", (org_id,)).fetchone()
    return bool(row and row["ok"])


def is_admin(conn: UserConn, org_id: UUID) -> bool:
    row = conn.execute("select private.is_admin(%s) as ok", (org_id,)).fetchone()
    return bool(row and row["ok"])


def is_staff(conn: UserConn, org_id: UUID) -> bool:
    row = conn.execute("select private.is_staff(%s) as ok", (org_id,)).fetchone()
    return bool(row and row["ok"])


def audit_log(conn: UserConn, org_id: UUID, limit: int) -> list[dict[str, Any]]:
    return conn.execute(
        """select id, actor_id, action, entity, entity_id, details, created_at, hash
           from public.audit_log where org_id = %s order by id desc limit %s""",
        (org_id, limit),
    ).fetchall()


def audit_chain_intact(conn: UserConn, org_id: UUID) -> bool:
    row = conn.execute("select private.verify_audit_chain(%s) as broken", (org_id,)).fetchone()
    return row is not None and row["broken"] is None


def append_audit(
    conn: UserConn,
    org_id: UUID,
    action: str,
    entity: str,
    entity_id: UUID | None,
    details: dict[str, Any],
) -> None:
    """The only write path to the audit log: actor is always the caller (auth.uid())."""
    conn.execute(
        "select private.append_audit(%s, %s, %s, %s, %s)",
        (org_id, action, entity, entity_id, json.dumps(details)),
    )
