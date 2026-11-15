# Changelog

Per milestone, newest first.

## Unreleased

### Changed
- Gateway: `app.py` is only the composition root (lifespan, middleware, `/health`). Auth and tenancy dependencies moved to `deps.py`, M1 routes to `routes_core.py`. OpenAPI output unchanged.
- Integration tests share `services/gateway/testing.py` (seeded users, tokens, purge helper) and one `TestClient` fixture.
- `make help`; `CHANGELOG.md`; READMEs updated for M2.

### Added
- `THIRD_PARTY_NOTICES.md` generated from shipped dependencies (`scripts/notices.py`, `--check` for staleness).
- `docs/runbooks/m2-gate-data.md`: the inputs only the owner can provide for the M2 gate, with formats and how they are run.

### Fixed
- Ingest rejects `.xlsx` files whose declared uncompressed size exceeds 256 MB (zip-bomb guard; closes D19).

### Removed
- 36 README-only placeholder folders for unbuilt modules (apps, connectors, infra, services). Planned modules stay mapped in `docs/architecture/domain-model.md`; each phase creates its folders when it builds them.

### Process
- Trunk-based branching adopted (owner decision 2026-10-11): `main` always green, short-lived squash-merged branches. See `CONTRIBUTING.md`.

## M5: Procurement OS (2026-10-13): in progress, on sample data

Started on the owner's instruction to finish everything; Gate B (real RFQs, measured cycle time) stays open.

### Added
- **RFQ lifecycle enforced in the database:** per-version approval, edits become new versions, "I sent it" is a person's record (QazSupply sends nothing), append-only offers, confirmation by the supplier or a named buyer, decision records by approvers only after close.
- **Guided RFQ builder:** templates, live ТЗ check (brand-locking, vague wording, missing parameters, conflicting standards) with a suggested rewrite, items, autosave on the device.
- **Offer comparison:** KZT at the offer-date National Bank rate, lead time, payment terms, Supplier 360 risk; client weights; sensitivity ("if lead time mattered 2x..."); unranked offers with reasons; phone cards.
- **Supplier portal:** invited supplier users answer in-app and never see competitors.
- **Decision record** memo and PDF; **catalogue** with forgiving ru/kk search, analogs with same/differs and reviewer feedback, price history; opt-in **anonymous price sharing** (k >= 5 orgs).
- Agent API (D24): read-only MCP tools at `/mcp/` and three skill packs.

### Fixed (found while building M5)
- The request transaction committed after the response (FastAPI default), racing write-then-read; dead pooled DB connections after a restart; silent sign-out when the API was down; sign-out did not revoke the session (D10).

## M4: Supplier 360 and compliance (2026-10-12): in progress, on sample data

Started before Gate A by owner override; every source is an invented sample adapter until real access exists. Acceptance items that need real suppliers and decisions stay open.

### Added
- **Supplier 360 dossier:** verdict strip (icon + words, top reasons), registry facts with source and date, ownership graph (keyboard navigable, 50+ parties) with a table view, screening with explanations, spend with the Evidence drawer, the score's factor table. Supplier list with verdicts. Per-org risk weights in Settings.
- **Screening:** sanctions/PEP by name across kk/ru/en/Kazakh Latin (explainable matcher, recall 1.0 / 0 false positives on the synthetic set), unreliable-supplier registry by BIN, dual-use on bought goods. A hit never blocks: a client admin or reviewer confirms or dismisses with a reason code; all audited.
- **Supplier onboarding:** buyer invites a supplier member; supplier completes details, documents (PDF/PNG/JPEG, fields confirmed by the supplier) and sends; a named human approves, returns or rejects. State machine in the database.
- Sample connectors `registries`, `goszakup` (РНУ), `opensanctions`, `dualuse`, with typed outages shown in the UI.

### Fixed (found while building M4)
- Concurrent uploads deadlocked the API (async handlers with sync DB calls); the audit hash chain forked under concurrent writes; concurrent normalisation runs duplicated suppliers. Each has a regression test.

## M3: X-ray product surface (2026-10-12): built, one acceptance check open

Started before the M2 gate by owner override (Gate A's paid audits need this surface). Open: live Ask citation coverage (>= 95%) re-run after a ref-format fix.

### Added
- **Review gate in the database:** reports move only draft -> in_review -> approved -> released; approval needs a decision on every finding and a signed approval; findings freeze after draft; every step audited by the DB; per-org two-person rule (QazSupply admins only). 44 pgTAP checks.
- **Review console:** keyboard-first (J K A E R), keep / keep with note / reject, SLA timer in text, decision history with before -> after, two-step release.
- **Client report:** narrative layout (prototype + rationale), every figure and sum opens the Evidence drawer with "reviewed by"; savings-by-type chart with a table; next steps.
- **PDF export:** same model and formatter as the screen; Evidence id on every figure; footer with report id, reviewer, date and page; IBM Plex with full Kazakh Cyrillic.
- **Ask:** opt-in per organization, released reports only, no tools, findings-only context; every sentence's numbers checked against what it cites before display; designed "I can't answer that from your data".
- **Evals:** `evals/ask` with 64 injections over four channels; obedient-model gate (0/56 structural hijacks) and live mode.

### Fixed
- Kazakh money and dates rendered differently across browsers and the PDF (runtime locale data); now one deterministic format.
- Ask held two database connections during the model call.

## M2: Spend X-ray engine (2026-10-09 to 2026-10-11): built, gate blocked

Built on synthetic data. The gate needs real ЕНС ТРУ access, 300 owner-labelled lines and two hand-audited datasets.

### Added
- **Ingest:** csv/xlsx preview and ingest with row-level error codes, sha256 idempotency per Organization, audit entries.
- **Normalize:** item matcher (RapidFuzz, Kazakh look-alike folding, Latin-to-Cyrillic transliteration, model-number variants, evidence floor, calibrated confidence, bundled-line flag); NBK FX to KZT with the rate date stored; supplier resolution by BIN, then normalised name; review queue with append-only match feedback.
- **Analyze:** five detectors (`price_variance`, `repeat_purchase`, `split_purchase`, `concentration`, `outlier`). Savings are recomputed by an exact-numeric SQL cross-check, and the run writes nothing if the two disagree. Findings carry Evidence.
- **Connectors:** mock ЕНС ТРУ adapter with a synthetic `SYN-*` classifier; NBK FX adapter.
- **Web:** upload wizard, keyboard-driven review queue, findings view with the Evidence drawer, in kk / ru / en.
- **Evals:** matcher golden set and realistic holdout, planted-findings set; report in `evals/REPORT-M2.md`.
- **DB:** M2 migration with RLS on every new table, pgTAP suite, controlled `qs.purge` for privileged cleanup of append-only rows.
- Docs: ADR 0007 (matching stack), OSS verification for M2, offboarding runbook, STRIDE T26-T38, tech debt D15-D20.

## M1: data platform, design system, app shell (2026-10-08 to 2026-10-09)

### Added
- Multi-tenant Postgres schema with RLS on every table, composite tenant FKs, append-only hash-chained audit log; pgTAP suites and local advisor lints. ADR 0006 (reference tables).
- FastAPI gateway: JWKS-verified Supabase JWTs; every query runs as the signed-in user so RLS applies to the API.
- Next.js app shell: sign-in, settings, audit log, component gallery; nonce CSP and security headers.
- Design tokens (light/dark, contrast-tested), i18n catalogs with key parity and Kazakh orthography tests, anime.js motion presets.
- Playwright e2e on three viewports, visual baselines, Lighthouse accessibility gate; CI with gitleaks, OSV, SBOM and licence scan.
- Repo hygiene: CONTRIBUTING, SECURITY, CODEOWNERS, Dependabot, PR and issue templates, docs map.

## M0: harness and blueprint (2026-10-08)

### Added
- Whole-product blueprint, domain vocabulary (`docs/glossary.md`), ADRs 0001-0005, specs, threat model.
