"""Database access as the signed-in user: every query runs as `authenticated` with the
caller's JWT claims, so Postgres RLS applies to the API exactly as it does to pgTAP tests."""

import json
from collections.abc import Iterator
from contextlib import contextmanager
from typing import cast

from psycopg import Connection
from psycopg.rows import DictRow, TupleRow, dict_row, tuple_row
from psycopg_pool import ConnectionPool

from services.gateway.auth import Principal

UserConn = Connection[DictRow]


class Database:
    def __init__(self, url: str) -> None:
        self._pool: ConnectionPool[UserConn] = ConnectionPool(
            url,
            min_size=1,
            max_size=10,
            open=False,
            kwargs={"row_factory": dict_row, "autocommit": False},
        )

    def open(self) -> None:
        self._pool.open(wait=True, timeout=10)

    def close(self) -> None:
        self._pool.close()

    def ping(self) -> bool:
        with self._pool.connection() as conn:
            return conn.execute("select 1 as ok").fetchone() is not None

    @contextmanager
    def service(self) -> Iterator[Connection[TupleRow]]:
        """Privileged connection for platform bookkeeping only (the LLM ledger). Never use it to
        read or write tenant data on a user's behalf: that is what `as_user` is for."""
        with self._pool.connection() as conn:
            plain = cast("Connection[TupleRow]", conn)
            plain.row_factory = tuple_row
            try:
                with plain.transaction():
                    yield plain
            finally:
                conn.row_factory = dict_row

    @contextmanager
    def as_user(self, principal: Principal) -> Iterator[UserConn]:
        with self._pool.connection() as conn, conn.transaction():
            conn.execute("set local role authenticated")
            conn.execute(
                "select set_config('request.jwt.claims', %s, true)",
                (json.dumps(principal.claims),),
            )
            yield conn
