from datetime import date
from typing import Any
from uuid import uuid4

from services.supplier360.dossier import signals

ROOT: dict[str, Any] = {
    "id": uuid4(),
    "kind": "company",
    "name": "ТОО «X»",
    "country": "KZ",
    "depth": 0,
    "registry_status": "active",
    "registered_on": date(2010, 1, 1),
}


def _run(topics: list[str], decision: str | None) -> dict[str, Any]:
    hit = {
        "id": uuid4(),
        "entry_name": "E",
        "entry_topics": topics,
        "decision": decision,
        "explanation": {},
    }
    return {
        "subject_id": ROOT["id"],
        "list_source": "opensanctions",
        "checked_at": None,
        "hits": [hit],
    }


def test_a_confirmed_crime_list_hit_is_not_a_sanctions_hit() -> None:
    sig, _ = signals(ROOT, [ROOT], [], [_run(["crime.fin"], "confirmed")], [], date(2026, 10, 12))
    assert sig["sanctions_confirmed"] is None and sig["sanctions_open"] is None
    assert sig["watchlist_match"] is not None


def test_a_sanctions_topic_counts_and_a_dismissal_clears_the_watchlist() -> None:
    sig, _ = signals(ROOT, [ROOT], [], [_run(["sanction"], "confirmed")], [], date(2026, 10, 12))
    assert sig["sanctions_confirmed"] is not None
    sig, _ = signals(ROOT, [ROOT], [], [_run(["crime.fin"], "dismissed")], [], date(2026, 10, 12))
    assert sig["watchlist_match"] is None
