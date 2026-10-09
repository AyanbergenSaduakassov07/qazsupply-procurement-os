# Tickets: Phases 1-3 (tracer bullets)

Each ticket is a thin vertical slice (DB -> service -> API -> UI -> e2e) that runs end to end, then later tickets thicken it. "Blocked by" lists hard dependencies. Size: S <= 2 days, M <= 1 week, L <= 2 weeks (at Q3 capacity, UNVERIFIED). Every ticket's done = repo Definition of Done (CLAUDE.md).

## Phase 1a: platform (M1): done (PR #1)

✅ = merged or in the open M1 PR. QS-005 ships the gateway with a test provider; the real Anthropic adapter is D11 in `docs/tech-debt.md`.
| Id | Ticket | Size | Blocked by | Acceptance (summary) |
|---|---|---|---|---|
| QS-001 ✅ | Auth + org switcher tracer: sign in, see your org name from DB via API | M | M0 | RLS test: user A never sees org B via UI/API; e2e |
| QS-002 ✅ | Tenancy context in gateway: request id, org from JWT, structured logs without PII | S | QS-001 | Log scan test finds no emails/BINs |
| QS-003 ✅ | Audit log (append-only, hash chain) + viewer for admins | M | QS-001 | Tamper test breaks chain; pgTAP no UPDATE/DELETE |
| QS-004 ✅ | Evidence model + `get_evidence(id)` drill-down + Evidence drawer component (from prototype) | M | QS-001 | A seeded figure opens drawer with rows + method; axe clean |
| QS-005 ✅ | LLM gateway skeleton: one task (`echo_redacted`), redaction, budget, kill switch, `llm_calls` | M | QS-002 | Kill switch test; redaction unit tests; no raw content stored |
| QS-006 ✅ | Design tokens 3 layers + dark mode + font glyph test (kk) | M | M0 | Glyph coverage report committed; contrast test |
| QS-007 ✅ | App shell: nav, language switch, Ask entry (disabled), notification center (empty) | M | QS-006 | Visual baselines 3 viewports x 2 themes x 3 langs |
| QS-008 ✅ | Reserve logistics tables with RLS + tests (no logic) | S | QS-001 | pgTAP per policy |
| QS-009 ✅ | Import-linter rule: no cross-module internal imports | S | M0 | CI fails on a planted violation |

## Phase 1b: Spend X-ray engine (M2)
| Id | Ticket | Size | Blocked by | Acceptance |
|---|---|---|---|---|
| QS-010 | Golden set v1: 300 labelled lines (ru/kk/mixed) + 10 messy file fixtures (synthetic/anonymised) | M | Q1 | Labelling guide; owner sign-off |
| QS-011 | Upload tracer: csv -> lines in DB with source row -> list in UI | M | QS-004 | Idempotent re-upload test; e2e |
| QS-012 | xlsx + mapping wizard + row error report | M | QS-011 | 10 fixtures pass; plain-language errors in 3 langs |
| QS-013 | ЕНС ТРУ loader (or mock adapter with badge) | S | data access | Contract test; licence row in register |
| QS-014 | Matcher v0 lexical + review queue (keyboard-first) | M | QS-013, QS-010 | Eval report top-1/top-5/abstain |
| QS-015 | Matcher v1 embeddings + LLM rerank within candidates | M | QS-014, QS-005 | >= 90% top-1 at <= 15% abstain; cost per 1k |
| QS-016 | Unit + currency normalization (dated FX via `fx` connector) | S | QS-011 | Property tests |
| QS-017 | Supplier resolution (name + BIN), reversible merges | M | QS-011 | Merge/unmerge tests |
| QS-018 | Detector: price variance (first finding end to end with Evidence) | M | QS-015, QS-016 | Figure reproduces from SQL; second implementation agrees |
| QS-019 | Detectors: repeat, split, concentration, outlier | M | QS-018 | Precision eval on 2 datasets >= 80% |
| QS-020 | Prompt-injection fixtures in uploads (cells, sheet names) | S | QS-012 | 0 hijacks |

## Phase 1c: X-ray product surface (M3) -> Gate A
| Id | Ticket | Size | Blocked by | Acceptance |
|---|---|---|---|---|
| QS-021 | Report draft from findings + reviewer console (approve/edit/reject) | L | QS-019, QS-003 | Audit entry per action |
| QS-022 | Release gate at DB + API + UI | M | QS-021 | Unreleased report unreachable, 3 layers tested |
| QS-023 | Client report view: narrative layout, count-up, Evidence drawer on every number | L | QS-022 | 3 langs; a11y; reduced motion |
| QS-024 | PDF export with Evidence refs and footer | M | QS-023 | PDF figures == screen figures |
| QS-025 | Ask: read-only tools + citation enforcement + designed refusal | L | QS-022, QS-005 | >= 95% cited; 50-attack suite 0 hijacks |
| QS-026 | First paid audit run end to end (ops ticket) | M | QS-024 | Owner signs off; lessons logged |

## Phase 2: Supplier 360 (M4)
| Id | Ticket | Size | Blocked by | Acceptance |
|---|---|---|---|---|
| QS-030 | goszakup adapter: participant + РНУ by BIN (token required) | M | token | Contract test; degraded states |
| QS-031 | Dossier tracer: BIN -> registry facts + РНУ flag with source/date | M | QS-030 | Every flag links source + date |
| QS-032 | OpenSanctions adapter (licensed) + per-call cost guard | M | licence | Budget test |
| QS-033 | Name matching kk/ru/en/Latin + labelled set | L | QS-032 | Zero known FN; FP load reported |
| QS-034 | Screening review: confirm/dismiss with reason codes; re-screen schedule | M | QS-033 | Never auto-blocks; audit trail |
| QS-035 | Party graph + owners (where lawful source exists) + table alternative | L | QS-031 | 50-node readability; keyboard nav |
| QS-036 | Risk score rules-first, org-editable weights | M | QS-031 | Weight change reflected; explanation shown |
| QS-037 | Supplier onboarding on phone: invite -> checklist -> docs -> confirm -> review | L | QS-034 | Phone e2e; doc injection tests |

## Phase 3: Procurement OS (M5) -> Gate B
| Id | Ticket | Size | Blocked by | Acceptance |
|---|---|---|---|---|
| QS-040 | RFQ tracer: draft -> approve -> send (email) -> manual offer entry -> decision record | L | QS-037 | No send without approval; audit |
| QS-041 | Offer extraction from email/PDF + supplier confirmation | M | QS-040, QS-005 | Extraction F1 reported |
| QS-042 | Comparison matrix + weights + sensitivity view (prototype first) | L | QS-041 | Missing price / currency mix cases |
| QS-043 | LandedCost placeholder interface in comparison | S | QS-042 | Interface contract test |
| QS-044 | Catalogue: Item pages, price history, analog search | L | QS-019 | Search in 3 langs; filters explain empty |
| QS-045 | Consent + k-anonymous shared price bands | M | QS-044 | Leak tests below k |
| QS-046 | ТЗ checker v0: brand-lock + missing-parameter rules | M | QS-044 | Spans cited; golden set F1 |
