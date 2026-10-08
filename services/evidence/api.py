"""Evidence module: the drill-down behind any figure (see public.get_evidence)."""

from typing import Any
from uuid import UUID

from services.gateway.db import UserConn


def get(conn: UserConn, org_id: UUID, evidence_id: UUID) -> dict[str, Any] | None:
    row = conn.execute("select public.get_evidence(%s) as e", (evidence_id,)).fetchone()
    evidence: dict[str, Any] | None = row["e"] if row else None
    if evidence is None or evidence["org_id"] != str(org_id):
        return None
    return evidence
