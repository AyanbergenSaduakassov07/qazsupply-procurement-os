"""M5 end to end through the API (Org A, seeded supplier member and suppliers)."""

from collections.abc import Iterator
from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from fastapi.testclient import TestClient

from services.gateway.testing import ORG_A, USERS, auth, purge
from services.procurement import api as proc

pytestmark = pytest.mark.integration
ALFA, BETA = "7a000000-0000-4000-a000-0000000000a1", "7a000000-0000-4000-a000-0000000000a4"
BASE = f"/orgs/{ORG_A}"


@pytest.fixture(autouse=True)
def cleanup(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    # No network in tests: one fixed USD rate.
    monkeypatch.setattr(
        proc,
        "RATE",
        [lambda cur, on: (Decimal("475.5"), date(2026, 10, 12)) if cur == "USD" else None],
    )
    yield
    purge(
        ("delete from public.rfqs where org_id = %s", (ORG_A,)),
        ("delete from public.catalogue_entries where org_id = %s", (ORG_A,)),
        ("delete from public.parties where org_id = %s", (ORG_A,)),
    )


def ok(r: Any, code: int = 200) -> Any:
    assert r.status_code == code, r.text
    return r.json() if r.content else None


def test_full_rfq_from_spec_to_decision(client: TestClient) -> None:
    buyer, admin, sup = auth("clientUserA"), auth("clientAdminA"), auth("supplier")
    spec = "Цемент М400 высокого качества, ГОСТ 31108-2020, в мешках по 50 кг."
    issues = {
        i["kind"]
        for i in ok(client.post(f"{BASE}/spec-check", headers=buyer, json={"text": spec}))["issues"]
    }
    assert issues == {"vague"}

    items = [
        {"name": "Цемент М400", "quantity": 40, "unit": "т"},
        {"name": "Доставка", "quantity": 1, "unit": "рейс"},
    ]
    rid = ok(
        client.post(
            f"{BASE}/rfqs",
            headers=buyer,
            json={"title": "Цемент Q4", "spec_text": spec, "items": items},
        ),
        201,
    )["id"]
    assert client.post(f"{BASE}/rfqs/{rid}/approve", headers=buyer, json={}).status_code == 403
    portal = ok(
        client.post(
            f"{BASE}/rfqs/{rid}/invites",
            headers=buyer,
            json={"supplier_id": ALFA, "channel": "portal", "email": USERS["users"]["supplier"]},
        ),
        201,
    )["id"]
    emailed = ok(
        client.post(
            f"{BASE}/rfqs/{rid}/invites",
            headers=buyer,
            json={"supplier_id": BETA, "channel": "email"},
        ),
        201,
    )["id"]
    r = client.post(f"{BASE}/rfq-invites/{emailed}/sent", headers=buyer)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "approval_required"
    ok(client.post(f"{BASE}/rfqs/{rid}/approve", headers=admin, json={"note": "OK"}), 204)
    for inv in (portal, emailed):
        ok(client.post(f"{BASE}/rfq-invites/{inv}/sent", headers=buyer), 204)
    assert ok(client.get(f"{BASE}/rfqs/{rid}", headers=buyer))["status"] == "sent"

    seen = ok(client.get(f"{BASE}/rfqs", headers=sup))
    assert [r["id"] for r in seen] == [rid]
    ok(
        client.post(
            f"{BASE}/rfqs/{rid}/offers",
            headers=sup,
            json={
                "invite_id": portal,
                "source": "portal",
                "currency": "KZT",
                "payment_days": 30,
                "lead_time_days": 21,
                "lines": [{"item": 0, "unit_price": 31000}, {"item": 1, "unit_price": 90000}],
            },
        ),
        201,
    )
    usd = ok(
        client.post(
            f"{BASE}/rfqs/{rid}/offers",
            headers=buyer,
            json={
                "invite_id": emailed,
                "source": "email",
                "currency": "USD",
                "payment_days": 45,
                "lead_time_days": 7,
                "lines": [{"item": 0, "unit_price": 64}, {"item": 1, "unit_price": 150}],
            },
        ),
        201,
    )["id"]

    c = ok(client.get(f"{BASE}/rfqs/{rid}/comparison", headers=buyer))
    assert {r["excluded"] for r in c["rows"]} == {None, "not_confirmed"}
    r = client.post(f"{BASE}/offers/{usd}/confirm", headers=buyer, json={})
    assert r.status_code == 409  # a buyer confirms with a note only
    ok(
        client.post(
            f"{BASE}/offers/{usd}/confirm", headers=buyer, json={"note": "Signed PDF, 12.10"}
        ),
        204,
    )
    c = ok(client.get(f"{BASE}/rfqs/{rid}/comparison", headers=buyer))
    usd_row = next(r for r in c["rows"] if r["offer_id"] == usd)
    assert usd_row["total_kzt"] == "1288605.00" and usd_row["rate_date"] == "2026-10-12"
    assert c["winner"] and len(c["sensitivity"]) == 8

    mine = ok(client.get(f"{BASE}/rfqs/{rid}", headers=sup))
    assert len(mine["offers"]) == 1 and len(mine["invites"]) == 1  # never another supplier's

    r = client.post(
        f"{BASE}/rfqs/{rid}/decision",
        headers=admin,
        json={"offer_id": c["winner"], "reason": "Best weighted score, lead time 7 days"},
    )
    assert r.status_code == 409 and r.json()["detail"]["code"] == "close_before_deciding"
    ok(client.post(f"{BASE}/rfqs/{rid}/close", headers=buyer), 204)
    r = client.post(
        f"{BASE}/rfqs/{rid}/decision",
        headers=buyer,
        json={"offer_id": c["winner"], "reason": "Best weighted score here"},
    )
    assert r.status_code == 403  # approvers award, never a client user (and never a machine)
    ok(
        client.post(
            f"{BASE}/rfqs/{rid}/decision",
            headers=admin,
            json={"offer_id": c["winner"], "reason": "Best weighted score, lead time 7 days"},
        ),
        201,
    )
    d = ok(client.get(f"{BASE}/rfqs/{rid}", headers=buyer))
    assert d["status"] == "decided" and len(d["decision"]["alternatives"]) == 2


def test_catalogue_search_is_forgiving_and_explains_empty_results(client: TestClient) -> None:
    buyer = auth("clientUserA")
    a = ok(
        client.post(
            f"{BASE}/catalogue",
            headers=buyer,
            json={"name": "Қолғап нитрилді", "attributes": {"material": "nitrile", "size": "L"}},
        ),
        201,
    )["id"]
    b = ok(
        client.post(
            f"{BASE}/catalogue",
            headers=buyer,
            json={
                "name": "Перчатки нитриловые",
                "attributes": {"material": "nitrile", "size": "M"},
            },
        ),
        201,
    )["id"]
    hits = ok(client.get(f"{BASE}/catalogue", headers=buyer, params={"q": "колгап"}))
    assert [h["id"] for h in hits["results"]] == [a]
    typo = ok(client.get(f"{BASE}/catalogue", headers=buyer, params={"q": "перчятки нитриловые"}))
    assert b in [h["id"] for h in typo["results"]]
    none = ok(
        client.get(f"{BASE}/catalogue", headers=buyer, params={"q": "перчатки", "attr": "size:XXL"})
    )
    assert none["results"] == [] and none["empty_reason"] == "filters_removed_all"
    analog = ok(client.get(f"{BASE}/catalogue/{a}/analogs", headers=buyer))[0]
    assert analog["id"] == b and analog["same"] == ["material"] and analog["differs"] == ["size"]
    ok(
        client.post(
            f"{BASE}/catalogue/{a}/analogs/{b}/feedback", headers=buyer, json={"accepted": True}
        ),
        204,
    )
    assert ok(client.get(f"{BASE}/catalogue-acceptance", headers=buyer))["rate"] == "1"
