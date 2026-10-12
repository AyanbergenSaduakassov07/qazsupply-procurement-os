"""Builds companies.json: an INVENTED company registry for M4 (no real people or companies).

BINs of the M2 demo suppliers are reused so their dossiers resolve. Three BINs simulate the
failure modes (down, rate limit, schema drift).
Run: uv run python -m connectors.registries.fixtures.build
"""

import json
import random
from pathlib import Path
from typing import Any

OUT = Path(__file__).parent / "companies.json"
VERSION = "sample-2026-10-12"


def person(ref: str, name: str, born: int, role: str, share: float | None = None) -> dict[str, Any]:
    return {
        "ref": ref,
        "kind": "person",
        "name": name,
        "country": "KZ",
        "birth_year": born,
        "role": role,
        "share_pct": share,
    }


def company(bin_: str, role: str, share: float | None = None) -> dict[str, Any]:
    return {"ref": bin_, "kind": "company", "bin": bin_, "role": role, "share_pct": share}


def build() -> dict[str, Any]:
    rng = random.Random(4)  # noqa: S311 - deterministic fixture, not security
    first = [
        "Айгүл",
        "Ерлан",
        "Нұрлан",
        "Дана",
        "Арман",
        "Сәуле",
        "Бауыржан",
        "Мадина",
        "Виктор",
        "Ольга",
        "Тимур",
        "Жанар",
        "Серік",
        "Гүлнар",
        "Данияр",
        "Әсел",
    ]
    last = [
        "Сапаров",
        "Әбенов",
        "Жанұзақов",
        "Қасымов",
        "Ким",
        "Петров",
        "Омаров",
        "Төлеуов",
        "Исаев",
        "Мұқанов",
        "Ли",
        "Сергеев",
        "Байжанов",
        "Нұрғалиев",
    ]
    minority = [
        person(
            f"P-G{i:02d}",
            f"{rng.choice(last)} {rng.choice(first)}",
            rng.randint(1950, 2000),
            "shareholder",
            1.0,
        )
        for i in range(45)
    ]
    companies = [
        {
            "bin": "123456789012",
            "name": "ТОО «Альфа»",
            "status": "active",
            "registered_on": "2015-03-02",
            "country": "KZ",
            "oked": "46.69",
            "owners": [
                person("P-001", "Сапарова Айгүл Нұрланқызы", 1979, "shareholder", 60),
                company("200540000001", "shareholder", 40),
                person("P-001", "Сапарова Айгүл Нұрланқызы", 1979, "beneficial_owner", 60),
                person("P-002", "Ким Виктор Сергеевич", 1968, "beneficial_owner", 40),
                person("P-003", "Әбенов Ерлан Маратұлы", 1985, "director"),
            ],
        },
        {
            "bin": "200540000001",
            "name": "ТОО «Степь Трейд Холдинг»",
            "status": "active",
            "registered_on": "2005-04-11",
            "country": "KZ",
            "oked": "64.20",
            "owners": [
                person("P-002", "Ким Виктор Сергеевич", 1968, "shareholder", 100),
                person("P-002", "Ким Виктор Сергеевич", 1968, "beneficial_owner", 100),
            ],
        },
        {
            "bin": "210987654321",
            "name": "ТОО «Бета»",
            "status": "active",
            "registered_on": "2021-09-15",
            "country": "KZ",
            "oked": "28.15",
            "owners": [
                person("P-004", "Жанұзақов Нұрлан Серікұлы", 1972, "shareholder", 100),
                person("P-004", "Жанұзақов Нұрлан Серікұлы", 1972, "beneficial_owner", 100),
            ],
        },
        {
            "bin": "100140011111",
            "name": "ТОО «Альфа Снаб»",
            "status": "active",
            "registered_on": "2010-01-14",
            "country": "KZ",
            "oked": "46.90",
            "owners": [
                person("P-005", "Омарова Дана Тимурқызы", 1990, "shareholder", 100),
                person("P-005", "Омарова Дана Тимурқызы", 1990, "beneficial_owner", 100),
            ],
        },
        {
            "bin": "100140022222",
            "name": "ТОО «Бета Логистик»",
            "status": "liquidated",
            "registered_on": "2010-01-14",
            "country": "KZ",
            "oked": "49.41",
            "owners": [person("P-006", "Петров Тимур Олегович", 1981, "shareholder", 100)],
        },
        {
            "bin": "100140033333",
            "name": "ТОО «Гамма Индастри»",
            "status": "active",
            "registered_on": "2010-01-14",
            "country": "KZ",
            "oked": "25.62",
            "owners": [
                company("300640000001", "shareholder", 55),
                *minority,
                person("P-007", "Қасымов Арман Бауыржанұлы", 1975, "beneficial_owner", 55),
                person("P-008", "Ли Ольга Викторовна", 1983, "director"),
            ],
        },
        {
            "bin": "300640000001",
            "name": "АО «Гамма Групп»",
            "status": "active",
            "registered_on": "2006-06-01",
            "country": "KZ",
            "oked": "64.20",
            "owners": [company("400740000001", "shareholder", 100)],
        },
        {
            "bin": "400740000001",
            "name": "Gamma Holdings Ltd",
            "status": "active",
            "registered_on": "2007-07-01",
            "country": "CY",
            "oked": None,
            "owners": [person("P-007", "Қасымов Арман Бауыржанұлы", 1975, "shareholder", 100)],
        },
        # Failure modes for degraded-state tests (the adapter raises SourceUnavailable).
        {"bin": "990000000001", "simulate": "down"},
        {"bin": "990000000002", "simulate": "rate_limited"},
        {"bin": "990000000003", "name": "ТОО «Дрейф»", "registered_on": "2020-01-01", "owners": []},
    ]
    return {
        "version": VERSION,
        "licence": "synthetic sample (no third-party data)",
        "companies": companies,
    }


if __name__ == "__main__":
    OUT.write_text(json.dumps(build(), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
