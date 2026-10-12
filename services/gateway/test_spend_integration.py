"""Upload API against the local Supabase stack: real auth, real RLS, real inserts."""

import time
from collections.abc import Iterator

import httpx
import pytest
from fastapi.testclient import TestClient

from services.gateway.testing import (
    INGEST_FIXTURES as FIX,
)
from services.gateway.testing import (
    ORG_A,
    ORG_B,
    RU_MAPPING,
    purge,
    token,
    unique,
)

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def clean_uploads() -> Iterator[None]:
    """Remove files this module created (lines cascade). Seed files are kept."""
    yield
    purge(("delete from public.files where name like 'it-%%'", ()))


def post(
    client: TestClient, user: str, path: str, name: str, data: bytes, **form: str
) -> httpx.Response:
    response: httpx.Response = client.post(
        path,
        headers={"Authorization": f"Bearer {token(user)}"},
        files={"file": (name, data)},
        data=form,
    )
    return response


def test_preview_suggests_mapping_without_storing(client: TestClient) -> None:
    data = (FIX / "01_ru_semicolon_cp1251.csv").read_bytes()
    r = post(client, "clientUserA", f"/orgs/{ORG_A}/uploads/preview", "it-01.csv", data)
    assert r.status_code == 200
    assert r.json()["missing_required"] == [] and r.json()["rows_total"] == 3


def test_upload_is_idempotent_by_file_hash(client: TestClient) -> None:
    data = (FIX / "01_ru_semicolon_cp1251.csv").read_bytes()
    first = post(
        client, "clientUserA", f"/orgs/{ORG_A}/uploads", "it-01.csv", data, mapping=RU_MAPPING
    )
    again = post(
        client, "clientUserA", f"/orgs/{ORG_A}/uploads", "it-01.csv", data, mapping=RU_MAPPING
    )
    assert first.status_code == 200 and first.json()["inserted"] == 3
    assert again.json()["duplicate"] is True and again.json()["file_id"] == first.json()["file_id"]


def test_bad_rows_are_reported_and_good_rows_stored(client: TestClient) -> None:
    data = (FIX / "08_row_errors.csv").read_bytes()
    mapping = '{"item_text":0,"unit_price":1,"purchased_on":2}'
    r = post(client, "clientUserA", f"/orgs/{ORG_A}/uploads", "it-08.csv", data, mapping=mapping)
    body = r.json()
    assert body["inserted"] == 1 and body["rejected"] == 5
    assert [e["code"] for e in body["errors"]] == [
        "missing_item",
        "bad_number",
        "negative_price",
        "missing_date",
        "bad_date",
    ]


def test_macro_workbook_is_rejected_with_a_code(client: TestClient) -> None:
    data = (FIX / "11_macros.xlsm").read_bytes()
    r = post(client, "clientUserA", f"/orgs/{ORG_A}/uploads/preview", "it-macro.xlsx", data)
    assert r.status_code == 422 and r.json()["detail"]["code"] == "macros"


def test_cannot_upload_into_another_tenant(client: TestClient) -> None:
    data = unique((FIX / "01_ru_semicolon_cp1251.csv").read_bytes())
    r = post(client, "clientAdminA", f"/orgs/{ORG_B}/uploads", "it-x.csv", data, mapping=RU_MAPPING)
    assert r.status_code == 404


def test_supplier_role_cannot_upload_spend_data(client: TestClient) -> None:
    data = unique((FIX / "01_ru_semicolon_cp1251.csv").read_bytes())
    r = post(client, "supplier", f"/orgs/{ORG_A}/uploads", "it-sup.csv", data, mapping=RU_MAPPING)
    assert r.status_code == 403


def test_upload_writes_an_audit_entry(client: TestClient) -> None:
    data = unique((FIX / "01_ru_semicolon_cp1251.csv").read_bytes())
    post(client, "clientUserA", f"/orgs/{ORG_A}/uploads", "it-audit.csv", data, mapping=RU_MAPPING)
    log = client.get(
        f"/orgs/{ORG_A}/audit-log", headers={"Authorization": f"Bearer {token('clientAdminA')}"}
    )
    assert log.json()["chain_intact"] is True
    assert log.json()["entries"][0]["action"] == "file.uploaded"


def test_50k_rows_ingest_under_60_seconds(client: TestClient) -> None:
    header = "Наименование;Количество;Цена;Дата;Поставщик\n"
    body = "".join(
        f"Перчатки нитриловые L {i % 97};{i % 50 + 1};{1000 + i % 900},50;"
        f"14.03.2026;ТОО Альфа {i % 40}\n"
        for i in range(50_000)
    )
    data = (header + body).encode()
    mapping = '{"item_text":0,"quantity":1,"unit_price":2,"purchased_on":3,"supplier_text":4}'
    start = time.perf_counter()
    r = post(client, "clientUserA", f"/orgs/{ORG_A}/uploads", "it-50k.csv", data, mapping=mapping)
    seconds = time.perf_counter() - start
    assert r.status_code == 200 and r.json()["inserted"] == 50_000
    print(f"50k rows ingested in {seconds:.1f} s")  # noqa: T201 - reported in the M2 report
    assert seconds < 60


def test_concurrent_uploads_do_not_deadlock(client: TestClient) -> None:
    """Two uploads at once both take the audit-chain advisory lock. When the handlers were
    `async def` with sync DB calls, the waiter blocked the event loop and the holder could
    never commit: the API hung until restart (found in the 2026-10-12 demo)."""
    from concurrent.futures import ThreadPoolExecutor

    base = (FIX / "01_ru_semicolon_cp1251.csv").read_bytes()

    def one(i: int) -> int:
        return post(
            client,
            "clientUserA",
            f"/orgs/{ORG_A}/uploads",
            f"it-conc-{i}.csv",
            unique(base),
            mapping=RU_MAPPING,
        ).status_code

    with ThreadPoolExecutor(4) as pool:
        codes = list(pool.map(one, range(4), timeout=30))
    assert codes == [200, 200, 200, 200]
