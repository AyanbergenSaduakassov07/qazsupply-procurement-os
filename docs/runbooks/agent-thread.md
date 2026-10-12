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

## 2026-10-11 | tidy | branch `chore/repo-tidy` (stacked on M2)
- **Done:** shared gateway test support (`testing.py`, `conftest.py`) replaces helpers duplicated across four integration suites; gateway split into `app.py` (composition root), `deps.py`, `routes_core.py`, `routes_spend.py` (OpenAPI byte-identical); `make help`; `CHANGELOG.md`; README status, docs map, gateway and scripts READMEs updated for M2; Hypothesis cache ignored.
- **Results:** `make check` green (JS lint/typecheck/tests, ruff, mypy, 76 unit + 15 contract); full pytest incl. 24 integration green on the local stack.
- **Not run:** e2e, visual and Lighthouse (no UI change in this branch).
- **Next:** owner approval to push and open a draft PR against `m2-spend-xray-engine`.
- **Update (same day):** removed 36 README-only placeholder folders (owner approved); owner chose trunk-based branching. Merge plan for the open stack (#1 -> #2 -> #3), squash only: owner merges #1; agent rebases the next branch onto `main` with `--onto`, force-pushes with lease, CI re-runs; repeat.

## 2026-10-11 | follow-ups | branch `chore/repo-tidy` (+ `harness/license-gate-workspace`)
- **Done:** D19 closed (xlsx inflate cap + test); THIRD_PARTY_NOTICES generated by `scripts/notices.py`; PROGRESS reconciled (M0 Q-row, closed follow-ups, merge order); D4/D11 "fix when" corrected (M2 made no model calls); `docs/runbooks/m2-gate-data.md` for the owner's gate inputs, incl. a draft OWS token request (owner sends).
- **Found:** `scripts/license_check.py` ran `pnpm licenses list --prod` at the workspace root, which returns `{}`: no JS licence was ever checked. Fixed with `-r` + fail-closed + CI notices check on `harness/license-gate-workspace` (locked surface, separate PR). All 119 shipped JS packages pass the existing allowlist.
- **Not done (needs owner):** D8 remote Supabase project, D12 native kk review, D14 paid plan, D17/D18 real data, CONTEXT.md review, merges.
- **Next:** M3 cannot start: RUN-NEXT 2a needs M2 built with a passing machine gate; M2's gate is not evaluable without the owner's data.

## 2026-10-12 | M3 | slice 1: review gate (DB + API)
- **Goal:** an unreviewed report is unreachable; one reviewer may approve + release (owner); four-eyes switch.
- **Done:** migration `20261012000000_m3_review_gate.sql` (transition trigger, finding freeze, review rules, audit by trigger, `finding_visible`, org `ask_enabled` / `four_eyes`); pgTAP `m3_review_gate.test.sql` (41 checks); `services.report.api` workflow + `routes_report.py` (403 staff_only, 409 reason codes); findings carry latest decision; API client regenerated; ADR 0008.
- **Fixed on the way:** findings select policy must use row columns (INSERT ... RETURNING cannot see the new row by id).
- **Results:** `make check` green; `make rls` PASS (4 pgTAP suites, advisors clean, 25 integration incl. the new end-to-end gate test).
- **Next:** slice 2: review console UI (`/[locale]/review`), then report narrative + PDF, then Ask.

## 2026-10-12 | M3 | slice 2: review console UI
- **Done:** console on `/[locale]/spend/reports/[id]` for staff (submit, per-finding keep / keep with note / reject with J K A E R, approve with note, reject, reopen, return, two-step release); SLA timer in text on the console and the reports list (`submitted_at` added to the list API); decision history with before -> after; 47 `gate.*` strings kk/ru/en (homoglyph guard now also approves `E`, `Esc`); e2e `review.spec.ts` full journey.
- **Results:** e2e on a production build (as CI): 117 passed, 0 failed, 2 flaky (passed on retry), 11 skipped (visual + desktop-only).
- **Local test hygiene:** `make rls` leaves integration rows in Org A; reset the DB (`supabase --workdir infra db reset`) before `make e2e`, or auth.spec audit/report counts fail. Run e2e against `next start`, not `next dev` (dev server races under parallel load: "Unexpected end of JSON input").
- **Known flake (pre-existing, M2):** `spend.spec` injection test vs the desktop keyboard-review test: the injection row sorts first in the Org B queue and the keyboard test briefly marks the first line. Fix: give the keyboard test its own uploaded line. Not changed in this slice.
- **Next:** slice 3: client report narrative + Evidence "who reviewed" + PDF (react-pdf + IBM Plex woff; OFL exception proposed in harness PR #4).

## 2026-10-12 | M3 | slice 3: client report + PDF
- **Done:** layout prototype (A narrative vs B dashboard, axe 0/0, A chosen with rationale); `ReportNarrative` (headline count-up -> ranked findings with actions -> savings by type chart + table -> next steps; every figure and sum opens the Evidence drawer, now with "reviewed by" and summed parts); `lib/report-model.ts` shared by screen and PDF (exact tiyn sums, `node --test`); PDF route `/[locale]/spend/reports/[id]/pdf` (@react-pdf/renderer 4.9.0 + IBM Plex woff, footer with report id / reviewer / date / page); reviewer names via `private.staff_name`; reviews ordered by `clock_timestamp()` (four-eyes tie bug); `FindingsView` removed.
- **Results:** `make check` green; `make rls` PASS; review journey e2e passes on a production build incl. PDF = screen figures, client 404 on unreleased PDF, Kazakh text extracted from the kk PDF, axe on en/kk/ru; PDF inspected by eye (3 pages, Kazakh glyphs, tabular figures, footers).
- **Compliance:** react-pdf adopted (MIT); `@ibm/plex-sans` OFL-1.1 exception proposed in harness PR #4 (owner to confirm); notices regenerated.
- **Not done yet:** visual baselines for the new report page (phase end); chart draw-in uses the section reveal, not a per-bar animation.
- **Next:** slice 4: Ask chat (tools over analyze/evidence, citation validator, refusal, OpenRouter dev provider; live evals wait for the owner's key).

## 2026-10-12 | M3 | slice 4: Ask + AI security + evals; phase-end checks
- **Done:** `services/ask` (no tools; findings-only context with F-refs; JSON answer; validator drops unbacked numbers, unknown refs, links/emails, rule leaks, poisoned names); route loads context in a short RLS transaction and holds no DB connection during the model call (`PooledLedger`); OpenRouter dev provider + scripted local provider (both refused unless the DB is local); org settings API + Settings card (Ask opt-in for admins, two-person rule for QazSupply admins); Ask panel (citations open the Evidence drawer, designed refusal, dropped-sentence note, AI label); `evals/ask` (16 questions, 64 injections, obedient + live modes, CI gate); OSS verification M3; STRIDE T39-T47; ADR 0008 Ask design; tech debt D21-D26; report visual baselines (18); Lighthouse covers the report (100).
- **Found and fixed by tests/evals:** poisoned supplier names laundering amounts; links to unlisted TLDs; checkbox not reflecting a click until refresh; review cleanup purging the seed report; Kazakh formatting differing between browsers and the PDF (Intl locale data); two pooled connections held per Ask during the model call.
- **Results:** `make check` green (106 py unit + 15 contract, JS tests); `make rls` PASS (pgTAP incl. m3 44 checks, advisors clean, 31 integration); e2e on a production build 119 passed / 0 flaky; visual 94/94; Lighthouse a11y 100 on new pages; obedient Ask eval: 0/56 structural hijacks displayed.
- **Next:** record the live Ask eval (free model, rate-limited) in PROGRESS; owner: approve push + PR for M3; merge order #1 -> #2 -> #3 -> #4 -> M3.

## 2026-10-12 | M3 follow-ups + M4 slices 0-2
- **Owner decisions (chat):** M4 starts by override on mock adapters (Gate A not passed); free APIs only (no OpenRouter credit, no Anthropic key); pushes to PR #5 and a later M4 draft PR approved.
- **M3 done:** live Ask eval re-run: 0/45 hijacks, citations 0.33, 19 provider errors = OpenRouter `:free` cap of 50 requests/day (docs) vs ~80 calls per run. Scorer split on `harness/ask-eval-split` (`--part questions|attacks:k/n`, local, not pushed). D20 classifier search in the review queue; D23 closed (no change needed); keyboard-review e2e flake fixed (own line, dated today).
- **Concurrency bugs found and fixed (M3 branch):** (1) upload handlers `async def` + sync psycopg deadlocked on the audit lock (fixed by a parallel session, committed here with its test); (2) audit chain forked under concurrent writes (id drawn before the lock) -> migration `20261012020000_audit_chain_order.sql` + `services/tenancy/test_audit_chain_integration.py` (NOT yet run: it writes to Org B, the owner's live demo org); (3) concurrent normalisation duplicated suppliers -> per-org advisory lock in `services/normalize/api.py`, test red (3-4 dupes) then green x4.
- **M4 slice 0:** `docs/research/oss-verification-M4.md` (nothing adopted; rigour dropped after a failed PyICU spike). Slice 1: migration `20261013000000_m4_supplier_360.sql`, pgTAP `m4_supplier_360.test.sql` (23 pass), seed rows in Org B. Slice 2: sample connectors registries/goszakup/opensanctions/dualuse + `connectors/outage.py`.
- **Shared local DB:** the owner is demoing on :3000 (Org B). Agreed with the other session: no `db reset`, no Org B writes until it says go. Local DB has migrations applied with `migration up` (no reset); Org A audit chain is broken from the pre-fix race until a reset; m1 suite shows 2 environment failures (Org A demo audit rows) until a reset.
- **Not run yet:** full e2e / visual / Lighthouse for D20 (phone run failed on the 50-line queue page, fixed by dating test lines today); audit-chain integration test.
- **Next:** slice 3 screening matcher + recall eval + API.
