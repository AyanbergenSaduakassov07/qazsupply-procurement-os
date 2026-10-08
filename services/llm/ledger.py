"""Postgres ledger for LLM calls. Uses a service connection: llm_calls has no user write grant."""

from decimal import Decimal
from uuid import UUID

from psycopg import Connection

from services.llm.gateway import CallRecord


class PostgresLedger:
    def __init__(self, conn: Connection[tuple[object, ...]]) -> None:
        self._conn = conn

    def month_spend_usd(self, org_id: UUID) -> Decimal:
        row = self._conn.execute(
            """select coalesce(sum(cost_usd), 0) from public.llm_calls
               where org_id = %s and created_at >= date_trunc('month', now())""",
            (org_id,),
        ).fetchone()
        return Decimal(str(row[0])) if row else Decimal(0)

    def monthly_budget_usd(self, org_id: UUID) -> Decimal:
        row = self._conn.execute(
            "select llm_monthly_budget_usd from public.organizations where id = %s", (org_id,)
        ).fetchone()
        return Decimal(str(row[0])) if row else Decimal(0)  # unknown org: zero budget

    def record(self, call: CallRecord) -> None:
        self._conn.execute(
            """insert into public.llm_calls (org_id, task, prompt_version, prompt_sha256, model,
                 input_tokens, output_tokens, cost_usd, redacted, latency_ms, status)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                call.org_id,
                call.task,
                call.prompt_version,
                call.prompt_sha256,
                call.model,
                call.input_tokens,
                call.output_tokens,
                call.cost_usd,
                call.redacted,
                call.latency_ms,
                call.status,
            ),
        )
