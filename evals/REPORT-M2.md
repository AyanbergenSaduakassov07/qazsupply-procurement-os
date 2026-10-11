# M2 eval report (2026-10-11)

**The M2 gate is NOT evaluated.** It requires real ЕНС ТРУ data, the owner's 300 hand-labelled lines and two hand-audited datasets (none exist yet; owner decision 2026-10-09). The numbers below are from synthetic and team-written data and are optimistic.

Commit: `dbfa110` · calibration `2026-10-09-synthetic` · log: `evals/matcher/results.jsonl`

## Matcher

| Metric | Synthetic test (150 lines) | Realistic holdout (50 lines, seen in development) | M2 gate |
|---|---|---|---|
| auto-precision | 1.0 | 1.0 |  |
| abstain (matchable lines) | 0.0775 | 0.4565 | <= 0.15 |
| top-1 | 0.9922 | 1.0 | >= 0.90 |
| top-5 | 1.0 | 1.0 |  |
| no-match lines not auto-coded | 1.0 | 1.0 |  |
| bundled lines flagged | 1.0 | n/a |  |

Per language (synthetic top-1): {'kk': 0.9524, 'latin': 1.0, 'mixed': 1.0, 'ru': 1.0}. Latency: 0.58 ms per line (lexical). **LLM cost per 1k lines: $0** (no model calls; re-rank not enabled).

Reading: lexical matching is precise (no wrong auto-codes, no-match lines never auto-coded) but on realistic text it abstains on 46% of lines because the confidence calibration was fitted on synthetic data. Refit on the owner's labelled set (D18) before judging the gate.

## Detectors (planted findings)

| Dataset | Lines | Precision | Recall |
|---|---|---|---|
| synthetic-101 | 229 | 1.0 | 0.9474 |
| synthetic-202 | 302 | 1.0 | 1.0 |

| Type | Precision (ds1 / ds2) | Reported (ds1 / ds2) | Planted (ds1 / ds2) |
|---|---|---|---|
| concentration | 1.0 / 1.0 | 2 / 5 | 1 / 1 |
| outlier | 1.0 / 1.0 | 5 / 6 | 5 / 6 |
| price_variance | 1.0 / 1.0 | 5 / 8 | 6 / 8 |
| repeat_purchase | 1.0 / 1.0 | 3 / 4 | 3 / 4 |
| split_purchase | 1.0 / 1.0 | 4 / 5 | 4 / 5 |

Concentration findings are verified by recomputing the supplier share from the data (planted orders of other types legitimately concentrate items). The eval exposed three detector defects that were fixed before these numbers: double-counted savings, single-spike sensitivity, outliers on tight price bands.

## Performance

50,000-row CSV ingested in 3.6 s on the local stack (target < 60 s), via the real API with RLS (`test_50k_rows_ingest_under_60_seconds`).

## Not evaluated
- The M2 gate (real data).
- LLM re-rank quality and cost (adapter not built, D11).
- Embedding retrieval (deferred, ADR 0007).
- Kazakh lines from real exports (synthetic kk only).
