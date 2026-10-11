# services/normalize

Purchase Lines -> unit, KZT price, Item, Supplier; plus the human review loop.

**Public interface** (`services.normalize.api`):
- `run(conn, org_id, file_id=None) -> RunSummary`: for pending lines: unit, FX to KZT (NBK rate on or before the purchase date, rate date stored), item match, supplier resolution (BIN, then normalised legal name).
- `queue(conn, org_id, limit, offset)`, `review(conn, org_id, line_id, action, code=None)` (accept / choose / reject / undo; each writes `match_feedback`), `counts(conn, org_id)`, `classifier()`.

**Matcher** (`matcher.py`, ADR 0007): lexical (RapidFuzz) over ru/kk names with Kazakh look-alike folding, Latin transliteration, acronyms and model-number variants; evidence floor 70; calibrated confidence (`calibration.json`, fitted by `evals/matcher/train.py`); bundled lines flagged; optional re-rank may only choose among retrieved codes. Evals: `evals/matcher`.
