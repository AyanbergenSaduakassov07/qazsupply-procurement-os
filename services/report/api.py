"""Report module (read side for M1). Clients only ever see released reports (RLS)."""

from typing import Any
from uuid import UUID

from services.gateway.db import UserConn


def list_reports(conn: UserConn, org_id: UUID) -> list[dict[str, Any]]:
    return conn.execute(
        """select id, title, period_start, period_end, status::text as status, version, released_at
           from public.reports where org_id = %s order by period_end desc""",
        (org_id,),
    ).fetchall()
