"""Shared support for the gateway integration tests (local Supabase stack, `make rls`).

Not a test module: constants and helpers only. The `client` fixture lives in conftest.py.
"""

import json
import os
import subprocess  # noqa: S404 - fixed argv
import uuid
from functools import cache
from pathlib import Path

import httpx
import psycopg

ROOT = Path(__file__).resolve().parents[2]
USERS = json.loads((ROOT / "e2e/fixtures/users.json").read_text())
ORG_A, ORG_B = USERS["orgs"]["A"], USERS["orgs"]["B"]
DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
INGEST_FIXTURES = ROOT / "services" / "ingest" / "fixtures"
RU_MAPPING = (
    '{"item_text":0,"quantity":1,"unit":2,"unit_price":3,"purchased_on":4,'
    '"supplier_text":5,"supplier_bin":6}'
)


@cache
def publishable_key() -> str:
    if key := os.environ.get("SUPABASE_PUBLISHABLE_KEY"):
        return key
    out = subprocess.run(  # noqa: S603
        ["supabase", "status", "--workdir", "infra", "-o", "json"],  # noqa: S607
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return str(json.loads(out)["PUBLISHABLE_KEY"])


@cache
def token(user: str) -> str:
    """Access token for a seeded user (real password grant against local Supabase Auth)."""
    r = httpx.post(
        "http://127.0.0.1:54321/auth/v1/token?grant_type=password",
        headers={"apikey": publishable_key()},
        json={"email": USERS["users"][user], "password": USERS["password"]},
    )
    r.raise_for_status()
    return str(r.json()["access_token"])


def auth(user: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token(user)}"}


def unique(data: bytes) -> bytes:
    """Same content for the parser, new sha256 (uploads are idempotent by hash)."""
    return data + f"\n#{uuid.uuid4()}".encode()


def purge(*statements: tuple[str, tuple[object, ...]]) -> None:
    """Local test cleanup through the controlled purge (docs/runbooks/offboarding.md)."""
    with psycopg.connect(DB) as conn:
        conn.execute("set local qs.purge = 'on'")
        for sql, params in statements:
            conn.execute(sql, params)
