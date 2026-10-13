"""Supplier 360 end to end against the local stack (Org A only; sample sources).

Build a dossier -> ownership chain cached with provenance -> screening hits with explanations ->
a client user cannot decide -> an admin dismisses a namesake and confirms a match -> verdict.
"""

import json
import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import psycopg
import pytest
from fastapi.testclient import TestClient

from connectors.registries.sample import FIXTURE, SampleRegistry
from services.gateway.testing import DB, ORG_A, ORG_B, auth, purge
from services.supplier360 import api as s360

pytestmark = pytest.mark.integration


def _supplier(name: str, bin_: str | None) -> str:
    sid = str(uuid.uuid4())
    with psycopg.connect(DB) as conn:
        conn.execute(
            "insert into public.suppliers (id, org_id, name, bin) values (%s, %s, %s, %s)",
            (sid, ORG_A, name, bin_),
        )
    return sid


@pytest.fixture
def suppliers() -> Iterator[dict[str, str]]:
    made = {
        "alfa": _supplier("ТОО «Альфа» (it)", "123456789012"),
        "down": _supplier("ТОО «Down» (it)", "990000000001"),
        "unresolved": _supplier("ИП Без БИН (it)", None),
    }
    yield made
    purge(
        ("delete from public.parties where org_id = %s", (ORG_A,)),
        ("delete from public.suppliers where id = any(%s)", (list(made.values()),)),
        ("update public.organizations set risk_config = '{}' where id = %s", (ORG_A,)),
    )


def _get(client: TestClient, user: str, path: str) -> Any:
    r = client.get(path, headers=auth(user))
    assert r.status_code == 200, r.text
    return r.json()


def test_dossier_screening_and_decisions(client: TestClient, suppliers: dict[str, str]) -> None:
    base = f"/orgs/{ORG_A}/suppliers/{suppliers['alfa']}/dossier"
    built = client.post(base, headers=auth("clientUserA")).json()
    assert built["degraded"] == [] and built["possible_matches"] >= 3

    d = _get(client, "clientUserA", base)
    names = {n["name"] for n in d["nodes"]}
    assert {"ТОО «Альфа»", "ТОО «Степь Трейд Холдинг»", "Сапарова Айгүл Нұрланқызы"} <= names
    assert all(
        n["sample"] and n["source_id"] == "registries" and n["fetched_at"] for n in d["nodes"]
    )
    hits = {h["entry_id"]: h for s in d["screenings"] for h in s["hits"]}
    assert {"SAMPLE-SAN-001", "SAMPLE-SAN-002", "SAMPLE-SAN-003", "SAMPLE-PEP-001"} <= set(hits)
    assert hits["SAMPLE-SAN-002"]["explanation"]["entry_birth_year"] == 1991  # the namesake clue
    assert d["risk"]["verdict"] == "caution" and "sanctions_open" in d["risk"]["top"]

    decide = f"/orgs/{ORG_A}/screening-hits/{{}}/decision"
    r = client.post(
        decide.format(hits["SAMPLE-SAN-002"]["id"]),
        headers=auth("clientUserA"),
        json={"decision": "dismissed", "reason_code": "different_birth_year"},
    )
    assert r.status_code == 403
    r = client.post(
        decide.format(hits["SAMPLE-SAN-002"]["id"]),
        headers=auth("clientAdminA"),
        json={"decision": "dismissed", "reason_code": "same_context"},
    )
    assert r.status_code == 422
    r = client.post(
        decide.format(hits["SAMPLE-SAN-002"]["id"]),
        headers=auth("clientAdminA"),
        json={"decision": "dismissed", "reason_code": "different_birth_year"},
    )
    assert r.status_code == 204
    r = client.post(
        decide.format(hits["SAMPLE-SAN-001"]["id"]),
        headers=auth("reviewer"),
        json={"decision": "confirmed", "reason_code": "same_identifiers"},
    )
    assert r.status_code == 204

    d = _get(client, "clientUserA", base)
    hits = {h["entry_id"]: h for s in d["screenings"] for h in s["hits"]}
    assert hits["SAMPLE-SAN-002"]["decision"] == "dismissed"
    assert hits["SAMPLE-SAN-001"]["decided_by_staff"] == "Demo Reviewer"
    assert d["risk"]["verdict"] == "high_risk" and d["risk"]["top"][0] == "sanctions_confirmed"


def test_degraded_unresolved_and_tenant_isolation(
    client: TestClient, suppliers: dict[str, str]
) -> None:
    down = client.post(
        f"/orgs/{ORG_A}/suppliers/{suppliers['down']}/dossier", headers=auth("clientUserA")
    )
    assert down.json()["degraded"][0]["reason"] == "down" and down.json()["party_id"] is None
    d = _get(client, "clientUserA", f"/orgs/{ORG_A}/suppliers/{suppliers['down']}/dossier")
    assert d["built"] is False and d["risk"] is None

    r = client.post(
        f"/orgs/{ORG_A}/suppliers/{suppliers['unresolved']}/dossier", headers=auth("clientUserA")
    )
    assert r.status_code == 409 and r.json()["detail"]["code"] == "supplier_unresolved"

    r = client.get(
        f"/orgs/{ORG_B}/suppliers/{suppliers['alfa']}/dossier", headers=auth("clientUserA")
    )
    assert r.status_code in (403, 404)
    r = client.post(
        f"/orgs/{ORG_A}/suppliers/{suppliers['alfa']}/dossier", headers=auth("supplier")
    )
    assert r.status_code in (403, 404)


def test_risk_weights_admin_only(client: TestClient, suppliers: dict[str, str]) -> None:
    path = f"/orgs/{ORG_A}/risk-weights"
    r = client.put(path, headers=auth("clientUserA"), json={"weights": {"young_company": 0}})
    assert r.status_code == 403
    r = client.put(path, headers=auth("clientAdminA"), json={"weights": {"young_company": 0}})
    assert r.status_code == 200 and r.json()["weights"]["young_company"] == 0


def test_a_registry_outage_keeps_cached_ownership(
    client: TestClient, suppliers: dict[str, str], tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    base = f"/orgs/{ORG_A}/suppliers/{suppliers['alfa']}/dossier"
    assert client.post(base, headers=auth("clientUserA")).status_code == 200
    before = {n["name"] for n in _get(client, "clientUserA", base)["nodes"]}
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    for c in data["companies"]:
        if c["bin"] == "200540000001":  # the holding that links to its beneficial owner
            c["simulate"] = "rate_limited"
    (tmp_path / "companies.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(s360, "_REGISTRY", SampleRegistry(tmp_path / "companies.json"))
    r = client.post(base, headers=auth("clientUserA")).json()
    assert r["degraded"][0]["reason"] == "rate_limited"
    after = {n["name"] for n in _get(client, "clientUserA", base)["nodes"]}
    assert after == before  # nothing erased by the outage


def test_rescreen_covers_resolved_suppliers_never_opened(
    client: TestClient, suppliers: dict[str, str]
) -> None:
    r = client.post(f"/orgs/{ORG_A}/screenings/rescreen-due", headers=auth("clientUserA"))
    assert r.status_code == 200 and r.json()["rescreened"] >= 2
    d = _get(client, "clientUserA", f"/orgs/{ORG_A}/suppliers/{suppliers['alfa']}/dossier")
    assert d["built"] is True and d["screenings"]


def test_unmatched_lines_are_screened_for_dual_use(
    client: TestClient, suppliers: dict[str, str]
) -> None:
    fid, sha = str(uuid.uuid4()), uuid.uuid4().hex * 2
    with psycopg.connect(DB) as conn:
        conn.execute(
            """insert into public.files (id, org_id, name, sha256, size_bytes, content_type,
                 storage_path, uploaded_by)
               values (%s, %s, 'it-dualuse.csv', %s, 1, 'text/csv', 'x', %s)""",
            (fid, ORG_A, sha, "00000000-0000-4000-a000-0000000000a1"),
        )
        conn.execute(
            """insert into public.purchase_lines (org_id, file_id, source_row, raw, item_text,
                 supplier_id) values (%s, %s, 2, '{}', 'Тепловизор FLIR E8', %s)""",
            (ORG_A, fid, suppliers["alfa"]),
        )
    try:
        base = f"/orgs/{ORG_A}/suppliers/{suppliers['alfa']}/dossier"
        assert client.post(base, headers=auth("clientUserA")).status_code == 200
        d = _get(client, "clientUserA", base)
        hits = [h["entry_id"] for s in d["items"] for h in s["hits"]]
        assert "SAMPLE-DU-01" in hits
        assert "dual_use_goods" in [f["code"] for f in d["risk"]["factors"] if f["triggered"]]
    finally:
        purge(("delete from public.files where id = %s", (fid,)))
