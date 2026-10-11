"""End to end on the local stack: upload -> normalise -> analysis (Python == SQL money) -> RLS."""

import random
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from services.gateway.testing import ORG_A, ORG_B, RU_MAPPING, purge
from services.gateway.testing import auth as h

pytestmark = pytest.mark.integration
ITEMS = [
    "Подшипник шариковый 6205",
    "Перчатки нитриловые",
    "Масло моторное 15W-40",
    "Болт М12",
    "Цемент М400",
    "Канат стальной",
]
SUPPLIERS = [
    ("ТОО Альфа", "100140011111"),
    ("ТОО Бета", "100140022222"),
    ("ТОО Гамма", "100140033333"),
]


def spend_csv(seed: int = 7) -> bytes:
    """3 suppliers x 3 orders per item; supplier Альфа is ~35% dearer on every second item;
    one wild outlier line. Russian number format, dd.mm.yyyy dates."""
    rng = random.Random(seed)  # noqa: S311 - test data, not crypto
    rows = ["Наименование;Количество;Ед. изм.;Цена;Дата;Поставщик;БИН"]
    for i, item in enumerate(ITEMS):
        base = rng.randint(1_000, 40_000)
        for s_i, (name, bin_) in enumerate(SUPPLIERS):
            for month in range(1, 4):
                markup = 1.35 if (i % 2 == 0 and s_i == 0) else 1 + rng.uniform(-0.03, 0.03)
                price = f"{base * markup:.2f}".replace(".", ",")
                day = 5 + s_i * 3
                rows.append(
                    f"{item};{rng.randint(2, 9)};шт;{price};"
                    f"{day:02d}.{month:02d}.2026;{name};{bin_}"
                )
    rows.append(f"{ITEMS[1]};3;шт;999 999,99;20.05.2026;ТОО Бета;100140022222")
    rows.append(f"#{rng.random()}")  # unique file hash per run
    return ("\n".join(rows) + "\n").encode()


@pytest.fixture(autouse=True)
def clean() -> Iterator[None]:
    yield
    purge(
        (
            "delete from public.findings where report_id in (select id from public.reports"
            " where title like 'Spend X-ray %%' and org_id = %s and status = 'draft'"
            " and created_at > now() - interval '1 hour')",
            (ORG_A,),
        ),
        (
            "delete from public.reports where org_id = %s and status = 'draft'"
            " and title like 'Spend X-ray %%-%%' and created_at > now() - interval '1 hour'",
            (ORG_A,),
        ),
        # Evidence pins its source lines (no cascade by design): remove this run's evidence first.
        (
            "delete from public.evidence where computation_id like 'analyze-%%'"
            " and created_at > now() - interval '1 hour' and org_id = %s",
            (ORG_A,),
        ),
        ("delete from public.files where name like 'it-%%'", ()),
    )


def test_analysis_end_to_end_with_sql_cross_check(client: TestClient) -> None:
    mapping = RU_MAPPING

    up = client.post(
        f"/orgs/{ORG_A}/uploads",
        headers=h("clientUserA"),
        files={"file": ("it-spend.csv", spend_csv())},
        data={"mapping": mapping},
    )
    assert up.status_code == 200, up.text
    norm = client.post(
        f"/orgs/{ORG_A}/normalize", headers=h("clientUserA"), json={"file_id": up.json()["file_id"]}
    )
    assert norm.json()["auto"] >= 50, norm.json()

    assert client.post(f"/orgs/{ORG_A}/analysis", headers=h("clientUserA")).status_code == 403
    run = client.post(f"/orgs/{ORG_A}/analysis", headers=h("reviewer"))
    assert run.status_code == 200, run.text  # 500 would mean Python and SQL money disagreed
    body = run.json()
    assert body["findings"] >= 3 and float(body["total_saving_kzt"]) > 0

    findings = client.get(
        f"/orgs/{ORG_A}/reports/{body['report_id']}/findings", headers=h("reviewer")
    ).json()
    types = {f["type"] for f in findings}
    assert "price_variance" in types and "outlier" in types
    pv = next(f for f in findings if f["type"] == "price_variance")
    assert pv["supplier_name"] == "ТОО Альфа" and pv["enstru_code"].startswith("SYN-")
    ev = client.get(f"/orgs/{ORG_A}/evidence/{pv['evidence_id']}", headers=h("reviewer")).json()
    assert len(ev["sources"]) >= 6 and float(ev["result"]) == float(pv["saving_estimate"])

    # Draft report: invisible to the client, and to another tenant.
    assert (
        client.get(
            f"/orgs/{ORG_A}/reports/{body['report_id']}/findings", headers=h("clientUserA")
        ).json()
        == []
    )
    assert (
        client.get(
            f"/orgs/{ORG_B}/reports/{body['report_id']}/findings", headers=h("clientAdminB")
        ).json()
        == []
    )
