"""Normalisation + review queue against the local Supabase stack."""

from collections.abc import Iterator
from decimal import Decimal

import httpx
import psycopg
import pytest
from fastapi.testclient import TestClient

from services.gateway.app import app
from services.gateway.test_api_integration import ORG_A, ORG_B, token
from services.gateway.test_spend_integration import DB, FIX, unique

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def clean() -> Iterator[None]:
    yield
    with psycopg.connect(DB) as conn:
        conn.execute(
            "set local qs.purge = 'on'"
        )  # local test cleanup only (runbooks/offboarding.md)
        conn.execute("delete from public.files where name like 'it-%'")


def auth(user: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token(user)}"}


def upload(client: TestClient, name: str, mapping: str) -> str:
    data = unique((FIX / name).read_bytes()) if name.endswith(".csv") else (FIX / name).read_bytes()
    r = client.post(
        f"/orgs/{ORG_A}/uploads",
        headers=auth("clientUserA"),
        files={"file": (f"it-{name}", data)},
        data={"mapping": mapping},
    )
    assert r.status_code == 200, r.text
    return str(r.json()["file_id"])


def normalize(client: TestClient, file_id: str) -> dict[str, object]:
    r: httpx.Response = client.post(
        f"/orgs/{ORG_A}/normalize", headers=auth("clientUserA"), json={"file_id": file_id}
    )
    assert r.status_code == 200, r.text
    body: dict[str, object] = r.json()
    return body


def test_normalize_matches_resolves_suppliers_and_converts_fx(client: TestClient) -> None:
    mapping = '{"item_text":0,"unit_price":1,"currency":2,"purchased_on":3}'
    file_id = upload(client, "06_mixed_currency.xlsx", mapping)
    summary = normalize(client, file_id)
    assert summary["processed"] == 3 and summary["fx_missing"] == 0 and summary["sample_classifier"]
    with psycopg.connect(DB) as conn:
        row = conn.execute(
            "select unit_price, currency, unit_price_kzt, fx_rate, fx_date "
            "from public.purchase_lines where file_id = %s and currency = 'USD'",
            (file_id,),
        ).fetchone()
    assert row is not None
    price, _, kzt, rate, fx_date = row
    assert str(fx_date) == "2026-05-02" and rate > 0
    assert kzt == (Decimal(price) * Decimal(rate)).quantize(Decimal("0.0001"))


def test_review_queue_accept_choose_reject_undo_with_feedback(client: TestClient) -> None:
    mapping = '{"item_text":0,"unit_price":1,"purchased_on":2,"supplier_text":3}'
    file_id = upload(client, "10_injection.csv", mapping)
    normalize(client, file_id)
    queue = client.get(f"/orgs/{ORG_A}/review-queue", headers=auth("reviewer")).json()
    lines = [ln for ln in queue["lines"] if ln["file_name"] == "it-10_injection.csv"]
    assert queue["sample_classifier"] is True and lines
    injected = next(ln for ln in lines if ln["item_text"].startswith("Ignore previous"))
    line = f"/orgs/{ORG_A}/purchase-lines/{injected['id']}/review"
    assert (
        client.post(line, headers=auth("reviewer"), json={"action": "reject"}).json()[
            "match_status"
        ]
        == "rejected"
    )
    assert (
        client.post(line, headers=auth("reviewer"), json={"action": "undo"}).json()["match_status"]
        == "review"
    )
    chosen = client.post(
        line, headers=auth("reviewer"), json={"action": "choose", "code": "SYN-PPE-001"}
    )
    assert chosen.json() == {
        "id": injected["id"],
        "match_status": "confirmed",
        "code": "SYN-PPE-001",
    }
    bad = client.post(
        line, headers=auth("reviewer"), json={"action": "choose", "code": "NOT-A-CODE"}
    )
    assert bad.status_code == 422
    with psycopg.connect(DB) as conn:
        actions = [
            r[0]
            for r in conn.execute(
                "select action from public.match_feedback "
                "where purchase_line_id = %s order by created_at",
                (injected["id"],),
            ).fetchall()
        ]
    assert actions == ["reject", "undo", "choose"]


def test_cannot_review_another_tenants_line(client: TestClient) -> None:
    with psycopg.connect(DB) as conn:
        row = conn.execute(
            "select id from public.purchase_lines where org_id = %s limit 1", (ORG_B,)
        ).fetchone()
    assert row is not None
    r = client.post(
        f"/orgs/{ORG_A}/purchase-lines/{row[0]}/review",
        headers=auth("reviewer"),
        json={"action": "reject"},
    )
    assert r.status_code == 404


def test_classifier_search_is_marked_sample(client: TestClient) -> None:
    r = client.get(f"/orgs/{ORG_A}/classifier?q=перчат", headers=auth("clientUserA")).json()
    assert r["sample"] is True and {e["code"] for e in r["entries"]} == {
        "SYN-PPE-001",
        "SYN-PPE-002",
    }
