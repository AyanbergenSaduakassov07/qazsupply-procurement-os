# Agent thread (append-only handoffs)

Format per entry: date, prompt, goal, done, failed, next, blockers. Newest at the bottom. Chat history is not state.

## 2026-10-09 | M2 | slice 1: matcher + evals
- **Goal:** M2 Part B normalisation, golden set first.
- **Done:** OSS re-verification (`docs/research/oss-verification-M2.md`, ADR 0007: RapidFuzz + Hypothesis + openpyxl adopted, rest deferred/dropped with triggers). ЕНС ТРУ access path found (goszakup `Lots.enstruList`, needs OWS token); synthetic sample connector `connectors/enstru` (codes `SYN-*`). Synthetic golden set (300 lines, seeded) + hand-written realistic holdout (50 lines). Matcher (`services/normalize/text.py`, `matcher.py`): fold kk look-alikes, Latin->Cyrillic, acronyms, model-number variants, evidence floor 70, logistic calibration from train split, bundled flag, rerank restricted to candidates. Gate test in pytest (`evals/matcher/test_gate.py`).
- **Results:** synthetic test: auto-precision 1.00, abstain 7.8%, top-1 0.99. Realistic holdout: auto-precision 1.00, no-match handled 1.00, top-1 1.00, **abstain 45.7%** (calibration fitted on synthetic data is too strict for real text).
- **Failed / honest:** M2 gate NOT evaluated (no owner-labelled set). Holdout is now "seen" (general fixes came from its misses).
- **Next:** slice 2 ingest (parse csv/xlsx, mapping, validation, idempotent upload, 50k rows < 60 s).
- **Blockers for the real gate:** OWS token for real ЕНС ТРУ; owner's 300 hand-labelled lines.
