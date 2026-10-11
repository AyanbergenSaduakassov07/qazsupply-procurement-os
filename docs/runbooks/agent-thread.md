# Agent thread (append-only handoffs)

Format per entry: date, prompt, goal, done, failed, next, blockers. Newest at the bottom. Chat history is not state.

## 2026-10-09 | M2 | slice 1: matcher + evals
- **Goal:** M2 Part B normalisation, golden set first.
- **Done:** OSS re-verification (`docs/research/oss-verification-M2.md`, ADR 0007: RapidFuzz + Hypothesis + openpyxl adopted, rest deferred/dropped with triggers). ЕНС ТРУ access path found (goszakup `Lots.enstruList`, needs OWS token); synthetic sample connector `connectors/enstru` (codes `SYN-*`). Synthetic golden set (300 lines, seeded) + hand-written realistic holdout (50 lines). Matcher (`services/normalize/text.py`, `matcher.py`): fold kk look-alikes, Latin->Cyrillic, acronyms, model-number variants, evidence floor 70, logistic calibration from train split, bundled flag, rerank restricted to candidates. Gate test in pytest (`evals/matcher/test_gate.py`).
- **Results:** synthetic test: auto-precision 1.00, abstain 7.8%, top-1 0.99. Realistic holdout: auto-precision 1.00, no-match handled 1.00, top-1 1.00, **abstain 45.7%** (calibration fitted on synthetic data is too strict for real text).
- **Failed / honest:** M2 gate NOT evaluated (no owner-labelled set). Holdout is now "seen" (general fixes came from its misses).
- **Next:** slice 2 ingest (parse csv/xlsx, mapping, validation, idempotent upload, 50k rows < 60 s).
- **Blockers for the real gate:** OWS token for real ЕНС ТРУ; owner's 300 hand-labelled lines.

## 2026-10-09 | M2 | slice 2: ingest
- **Done:** migration `20261009000000_m2_spend_engine.sql` (upload metadata, normalised line fields, supplier_bin, match_feedback append-only, finding subjects, per-org analysis_config); pgTAP `m2_rls.test.sql` (raw values immutable, feedback cannot be forged, supplier role blocked); `services/ingest` (csv/xlsx, cp1251, header detection, ru/kk/en mapping, row-level error codes, idempotent by sha256, raw cells kept); 10 synthetic messy fixtures + macro file; API `POST /uploads/preview`, `POST /uploads`, `GET /uploads` (router `routes_spend.py`), audit entry per upload, RLS denials -> 403.
- **Results:** 140 pgTAP pass; advisors clean; 91 pytest pass incl. 8 upload integration tests; **50k rows ingested in 3.6 s** (target < 60 s).
- **Fixed on the way:** JWT verification had zero clock-skew leeway (flaky 401 after auth restarts) -> 30 s leeway; `make rls` resets the local DB and waits for auth.
- **Next:** slice 3 normalisation run (match lines, units, FX, supplier resolution) + review queue API.

## 2026-10-11 | M2 | slice 3: normalisation run + review queue
- **Done:** `connectors/fx` (NBK official rates via `get_rates.cfm?fdate=`, real snapshots as fixtures, nearest-earlier rule with the rate date recorded, hostile XML refused); `services/normalize/api.py` (run: unit, FX to KZT, match, supplier resolution by BIN then normalised name; queue; review accept/choose/reject/undo with match_feedback); routes `/normalize`, `/match-counts`, `/review-queue`, `/purchase-lines/{id}/review`, `/classifier`.
- **Bugs found and fixed:** zero-score candidates were offered as suggestions; csv.Sniffer picked `,` when cells contained commas (now: header-row delimiter count); append-only trigger blocked tenant offboarding (now: DELETE-only purge for privileged roles in a `qs.purge` transaction, runbook `offboarding.md`, pgTAP proves UPDATE stays forbidden and app users gain nothing).
- **Results:** 142 pgTAP, advisors clean, 23 integration + unit suites green.
- **Env note:** OrbStack (Docker) had stopped between sessions; restarted with `orb start`.
- **Next:** slice 4 analysis engine (detectors + second SQL implementation + property tests + precision eval).

## 2026-10-11 | M2 | slice 4: analysis engine
- **Done:** `services/analyze` (config with documented per-org overrides; detectors price_variance, outlier, repeat_purchase, split_purchase, concentration; second independent SQL implementation of the money (exact numeric quantiles, no percentile_cont) used as a fail-closed guard on every run; run writes a draft report + findings + evidence as the reviewer under RLS). Staff insert policies for findings/evidence (no RLS-bypassing service connection). Routes `POST /analysis` (staff), `GET /reports/{id}/findings`. Synthetic planted-findings eval (`evals/findings`), gate test in pytest.
- **Bugs found by the eval and fixed:** double-counted savings (outlier lines inside a price_variance finding), one spike making a supplier "overpriced" (now supplier median), outliers on tight price bands (now also >= 30% above median). Generator artifacts fixed (split prices, balanced background).
- **Results:** synthetic precision 1.00 / 1.00, recall 0.95 / 1.00 (concentration verified by definition, reported separately); detector property tests (non-negative, exact scaling, reconciles to its evidence lines); end-to-end integration upload -> normalise -> analysis -> evidence with Python == SQL money.
- **Next:** slice 5 UX (upload wizard, review queue, findings) + Playwright, then phase-end checks and PR.

## 2026-10-11 | M2 | slice 5 + phase end
- **Done:** spend UI (upload wizard with mapping preview and plain-language row errors; keyboard-first review queue with "why", batch accept, undo, focus management; findings with Evidence drawer on every number; staff-only analysis button); 99+7 kk/ru/en strings; Playwright `spend.spec.ts` (upload, macro refusal, row errors, injection inert, client cannot analyse, keyboard review, analysis + evidence); visual baselines now include the upload screen; Lighthouse covers the spend pages.
- **Fixed:** visual gate was too lenient (1% of pixels let a changed menu pass) -> max 100 px; audit table columns depended on content length -> fixed table layout; local auth rate limit made runs flaky -> raised in local config only; parallel viewports shared the review queue -> keyboard journey on desktop only.
- **Phase end:** STRIDE M2 update (T26-T38), tech debt D15-D20, CONTEXT terms, module READMEs, eval report `evals/REPORT-M2.md`, PROGRESS -> blocked (gate needs real data).
- **Next:** owner review of the M2 PR (stacked on PR #1); provide real data to evaluate the gate. M3 is after Gate A and must not start before.
