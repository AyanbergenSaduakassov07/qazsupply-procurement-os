"""Load the local demo: a spend upload, a reviewed and released report, Ask on, and a second
report left as a draft so you can try the review console yourself.

Drives the real API as the real seeded users (Org B: client admin + reviewer), so the demo data
went through every rule the product enforces. Idempotent: does nothing if Org B already has a
released report. LOCAL STACK ONLY; synthetic data.

Usage: uv run python -m scripts.demo_seed   (normally called by `pnpm demo`)
"""

import logging
import random
import sys
from typing import Any

import httpx

from services.gateway.testing import ORG_B, RU_MAPPING
from services.gateway.testing import auth as as_user

API = "http://localhost:8000"
log = logging.getLogger("demo")
ITEMS = [
    "Подшипник шариковый 6205",
    "Перчатки нитриловые",
    "Масло моторное 15W-40",
    "Болт М12",
    "Цемент М400",
    "Канат стальной",
    "Кабель силовой ВВГ 3х2,5",
    "Электроды сварочные",
]
SUPPLIERS = [
    ("ТОО Альфа", "100140011111"),
    ("ТОО Бета", "100140022222"),
    ("ТОО Гамма", "100140033333"),
]


def spend_csv() -> bytes:
    """Six months, three suppliers; Альфа is ~35% dearer on every second item; one wild line."""
    rng = random.Random(2026)  # noqa: S311 - demo data, not crypto
    rows = ["Наименование;Количество;Ед. изм.;Цена;Дата;Поставщик;БИН"]
    for i, item in enumerate(ITEMS):
        base = rng.randint(1_500, 40_000)
        for s, (name, bin_) in enumerate(SUPPLIERS):
            for month in range(1, 7):
                markup = 1.35 if (i % 2 == 0 and s == 0) else 1 + rng.uniform(-0.03, 0.03)
                price = f"{base * markup:.2f}".replace(".", ",")
                rows.append(
                    f"{item};{rng.randint(2, 12)};шт;{price};"
                    f"{5 + s * 3:02d}.{month:02d}.2026;{name};{bin_}"
                )
    rows.append(f"{ITEMS[1]};3;шт;999 999,99;20.06.2026;ТОО Бета;100140022222")
    return ("\n".join(rows) + "\n").encode()


def call(client: httpx.Client, method: str, path: str, user: str, **kw: Any) -> Any:
    r = client.request(method, f"{API}/orgs/{ORG_B}{path}", headers=as_user(user), **kw)
    if r.status_code >= 400:
        raise SystemExit(f"demo seed failed: {method} {path} -> {r.status_code} {r.text[:200]}")
    return r.json() if r.content else None


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="  %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    with httpx.Client(timeout=120) as c:
        reports = call(c, "GET", "/reports", "clientAdminB")
        if any(r["status"] == "released" for r in reports):
            log.info("demo data already loaded (Org B has a released report)")
            return 0
        log.info("uploading purchases-h1-2026.csv as the client admin ...")
        up = call(
            c,
            "POST",
            "/uploads",
            "clientAdminB",
            files={"file": ("purchases-h1-2026.csv", spend_csv())},
            data={"mapping": RU_MAPPING},
        )
        call(c, "POST", "/normalize", "clientAdminB", json={"file_id": up["file_id"]})
        log.info("running the analysis as the reviewer ...")
        run = call(c, "POST", "/analysis", "reviewer")
        rid = run["report_id"]
        if rid is None:
            raise SystemExit("demo seed failed: the analysis found nothing")
        call(c, "POST", f"/reports/{rid}/submit", "reviewer")
        findings = call(c, "GET", f"/reports/{rid}/findings", "reviewer")
        for i, f in enumerate(findings):
            if i == len(findings) - 1:
                body = {
                    "decision": "reject",
                    "note": "One-off emergency order, agreed with the buyer.",
                }
            elif i == 1:
                body = {
                    "decision": "edit",
                    "note": "Confirmed with the buyer: the same grade was available cheaper.",
                }
            else:
                body = {"decision": "approve"}
            call(c, "POST", f"/reports/{rid}/findings/{f['id']}/decision", "reviewer", json=body)
        call(
            c,
            "POST",
            f"/reports/{rid}/approve",
            "reviewer",
            json={"note": "Checked against the source rows."},
        )
        call(c, "POST", f"/reports/{rid}/release", "reviewer")
        call(c, "PATCH", "/settings", "clientAdminB", json={"ask_enabled": True})
        log.info("released report %s with %d findings (1 rejected), Ask on", rid, len(findings))
        # A second run leaves a draft for you to review in the console (submit, J/K/A/E/R).
        draft = call(c, "POST", "/analysis", "reviewer")
        log.info("draft report %s is waiting for the reviewer", draft["report_id"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
