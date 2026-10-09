"""Shared loaders for the matcher evals."""

import csv
import json
from pathlib import Path

from services.normalize.matcher import Entry

ROOT = Path(__file__).resolve().parents[2]
GOLDEN = Path(__file__).parent / "golden_synthetic.csv"
# Hand-written, export-style lines labelled independently of the matcher rules (still by the
# same team, not the owner). A less biased check than the generated set.
HOLDOUT = Path(__file__).parent / "holdout_realistic.csv"


def sample_entries() -> list[Entry]:
    data = json.loads((ROOT / "connectors/enstru/fixtures/sample_codes.json").read_text())
    return [Entry(c["code"], (c["name_ru"], c["name_kk"])) for c in data["codes"]]


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def golden(split: str) -> list[dict[str, str]]:
    return [r for r in read_rows(GOLDEN) if r["split"] == split]
