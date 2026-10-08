"""API isolation tests against the local Supabase stack (`make rls` starts it).

Real sign-ins with the seeded users, real JWKS verification, real RLS.
"""

import json
import os
import subprocess  # noqa: S404 - fixed argv
from collections.abc import Iterator
from functools import cache
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from services.gateway.app import app

pytestmark = pytest.mark.integration
ROOT = Path(__file__).resolve().parents[2]
FIXTURE = json.loads((ROOT / "e2e/fixtures/users.json").read_text())
ORG_A, ORG_B = FIXTURE["orgs"]["A"], FIXTURE["orgs"]["B"]
RELEASED_EVIDENCE = "60000000-0000-4000-a000-00000000000a"
DRAFT_EVIDENCE = "60000000-0000-4000-a000-0000000000a2"
B_EVIDENCE = "60000000-0000-4000-a000-00000000000b"


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
    r = httpx.post(
        "http://127.0.0.1:54321/auth/v1/token?grant_type=password",
        headers={"apikey": publishable_key()},
        json={"email": FIXTURE["users"][user], "password": FIXTURE["password"]},
    )
    r.raise_for_status()
    return str(r.json()["access_token"])


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def get(client: TestClient, user: str, path: str) -> httpx.Response:
    response: httpx.Response = client.get(path, headers={"Authorization": f"Bearer {token(user)}"})
    return response


def test_health_sees_the_database(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok", "db": "ok"}


def test_me_lists_only_own_memberships(client: TestClient) -> None:
    body = get(client, "clientAdminA", "/me").json()
    assert {m["org_id"] for m in body["memberships"]} == {ORG_A}
    assert body["email"] == FIXTURE["users"]["clientAdminA"]


@pytest.mark.parametrize(
    "path",
    [
        f"/orgs/{ORG_B}/reports",
        f"/orgs/{ORG_B}/audit-log",
        f"/orgs/{ORG_B}/evidence/{B_EVIDENCE}",
        f"/orgs/{ORG_A}/evidence/{B_EVIDENCE}",  # right org in the path, wrong-tenant id
    ],
)
def test_org_a_cannot_reach_org_b(client: TestClient, path: str) -> None:
    assert get(client, "clientAdminA", path).status_code == 404


def test_client_user_sees_released_evidence_but_not_draft(client: TestClient) -> None:
    ok = get(client, "clientUserA", f"/orgs/{ORG_A}/evidence/{RELEASED_EVIDENCE}")
    assert ok.status_code == 200
    assert [s["source_row"] for s in ok.json()["sources"]] == [12, 57, 88]
    assert get(client, "clientUserA", f"/orgs/{ORG_A}/evidence/{DRAFT_EVIDENCE}").status_code == 404


def test_reports_are_filtered_by_role(client: TestClient) -> None:
    client_view = get(client, "clientUserA", f"/orgs/{ORG_A}/reports").json()
    reviewer_view = get(client, "reviewer", f"/orgs/{ORG_A}/reports").json()
    assert [r["status"] for r in client_view] == ["released"]
    assert sorted(r["status"] for r in reviewer_view) == ["draft", "released"]


def test_audit_log_is_admin_only_and_chain_verifies(client: TestClient) -> None:
    admin = get(client, "clientAdminA", f"/orgs/{ORG_A}/audit-log")
    assert admin.status_code == 200
    assert admin.json()["chain_intact"] is True
    assert len(admin.json()["entries"]) >= 2
    assert get(client, "clientUserA", f"/orgs/{ORG_A}/audit-log").status_code == 403


def test_forged_token_is_rejected(client: TestClient) -> None:
    head, body, _sig = token("clientAdminA").split(".")
    forged = f"{head}.{body}.{'A' * 86}"
    assert client.get("/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401
