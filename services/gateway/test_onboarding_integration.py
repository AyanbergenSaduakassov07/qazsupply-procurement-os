"""Supplier onboarding end to end (Org A; seeded supplier member and sample supplier)."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from services.gateway.testing import ORG_A, USERS, auth, purge

pytestmark = pytest.mark.integration
ALFA = "7a000000-0000-4000-a000-0000000000a1"
PDF = b"%PDF-1.4\n% sample\n"


@pytest.fixture(autouse=True)
def cleanup() -> Iterator[None]:
    yield
    purge(
        ("delete from public.onboarding_cases where org_id = %s", (ORG_A,)),
        ("delete from public.parties where org_id = %s", (ORG_A,)),
    )


def test_invite_fill_submit_and_human_check(client: TestClient) -> None:
    base = f"/orgs/{ORG_A}/onboarding"
    r = client.post(
        base,
        headers=auth("clientUserA"),
        json={"supplier_id": ALFA, "email": USERS["users"]["supplier"]},
    )
    assert r.status_code in (403, 409)  # a client user cannot invite
    r = client.post(
        base,
        headers=auth("clientAdminA"),
        json={"supplier_id": ALFA, "email": USERS["users"]["clientUserA"]},
    )
    assert r.status_code == 409 and r.json()["detail"]["code"] == "not_a_supplier_member"
    r = client.post(
        base,
        headers=auth("clientAdminA"),
        json={"supplier_id": ALFA, "email": USERS["users"]["supplier"]},
    )
    assert r.status_code == 201
    case = f"{base}/{r.json()['id']}"

    sup = auth("supplier")
    assert client.get(base, headers=sup).json()[0]["mine"] is True
    r = client.post(f"{case}/submit", headers=sup)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "details_incomplete"
    details = {
        "legal_name": "ТОО «Альфа»",
        "bin": "123456789012",
        "contact_name": "Айгүл",
        "contact_phone": "+7 701 000 00 00",
    }
    assert client.put(f"{case}/details", headers=sup, json=details).status_code == 204
    r = client.post(
        f"{case}/documents",
        headers=sup,
        files={"file": ("x.exe", b"MZ\x90\x00")},
        data={"kind": "charter"},
    )
    assert r.status_code == 422 and r.json()["detail"]["code"] == "unsupported_file_type"
    r = client.post(f"{case}/submit", headers=sup)
    assert r.json()["detail"]["code"] == "document_required"
    r = client.post(
        f"{case}/documents",
        headers=sup,
        files={"file": ("reg.pdf", PDF)},
        data={"kind": "registration_certificate", "doc_number": "R-42", "fields_confirmed": "true"},
    )
    assert r.status_code == 201
    doc = r.json()["id"]
    assert client.post(f"{case}/submit", headers=sup).status_code == 204
    assert (
        client.put(f"{case}/details", headers=sup, json=details).json()["detail"]["code"]
        == "locked_for_supplier"
    )

    r = client.get(f"{case}/documents/{doc}", headers=auth("clientUserA"))
    assert r.status_code == 200 and r.content == PDF
    assert r.headers["content-disposition"].startswith("attachment")
    assert r.headers["x-content-type-options"] == "nosniff"

    decide = f"{case}/decision"
    r = client.post(decide, headers=auth("clientAdminA"), json={"decision": "reject"})
    assert r.json()["detail"]["code"] == "note_required"
    r = client.post(
        decide, headers=auth("reviewer"), json={"decision": "approve", "note": "Registry matches"}
    )
    assert r.status_code == 200 and r.json()["screenings"] > 0
    got = client.get(case, headers=auth("clientAdminA")).json()
    assert got["status"] == "approved" and got["decided_by_staff"] == "Demo Reviewer"


def test_approval_screens_the_declared_bin_and_fills_an_empty_one(client: TestClient) -> None:
    import uuid  # noqa: PLC0415

    import psycopg  # noqa: PLC0415

    from services.gateway.testing import DB  # noqa: PLC0415

    sid = str(uuid.uuid4())
    with psycopg.connect(DB) as conn:
        conn.execute(
            "insert into public.suppliers (id, org_id, name) values (%s, %s, 'ИП без БИН (it)')",
            (sid, ORG_A),
        )
    try:
        base = f"/orgs/{ORG_A}/onboarding"
        r = client.post(
            base,
            headers=auth("clientAdminA"),
            json={"supplier_id": sid, "email": USERS["users"]["supplier"]},
        )
        case = f"{base}/{r.json()['id']}"
        sup = auth("supplier")
        client.put(
            f"{case}/details", headers=sup, json={"legal_name": "ТОО «Бета»", "bin": "210987654321"}
        )
        client.post(
            f"{case}/documents",
            headers=sup,
            files={"file": ("r.pdf", PDF)},
            data={"kind": "registration_certificate", "fields_confirmed": "true"},
        )
        assert client.post(f"{case}/submit", headers=sup).status_code == 204
        assert client.get(case, headers=auth("clientAdminA")).json()["supplier_bin"] is None
        r = client.post(
            f"{case}/decision", headers=auth("clientAdminA"), json={"decision": "approve"}
        )
        assert r.json()["screenings"] > 0  # screened by the declared BIN
        with psycopg.connect(DB) as conn:
            row = conn.execute("select bin from public.suppliers where id = %s", (sid,)).fetchone()
        assert row == ("210987654321",)
    finally:
        purge(
            ("delete from public.onboarding_cases where supplier_id = %s", (sid,)),
            ("delete from public.suppliers where id = %s", (sid,)),
        )
