# Prioritization: RICE, tech-debt budget, build vs buy

Status: M0 draft (2026-10-08). All inputs are estimates before Phase 0 interviews; re-score after interviews and after Gate A.

## RICE
Reach = client orgs touched in the first 12 months after launch of the capability. Impact: 3 massive, 2 high, 1 medium, 0.5 low. Confidence: evidence we have today. Effort: builder-weeks at Q3 capacity (UNVERIFIED).

| Rank | Spec | Reach | Impact | Confidence | Effort (wk) | Score | Why |
|---|---|---|---|---|---|---|---|
| 1 | C01 Ingest | 10 | 3 | 90% | 3 | 9.0 | Nothing works without it; well understood |
| 2 | C02 Matching | 10 | 3 | 70% | 4 | 5.25 | Core of price comparison; ЕНС ТРУ access unknown |
| 3 | C03 Findings | 10 | 3 | 70% | 4.5 | 4.67 | The thing clients pay for |
| 4 | C04 Report + review | 10 | 2 | 90% | 4 | 4.5 | Trust + paid audit deliverable |
| 5 | C06 Supplier 360 | 8 | 2 | 60% | 4 | 2.4 | Source access partly verified |
| 6 | C07 Screening | 8 | 2 | 50% | 4 | 2.0 | Paid licence + legal unknowns |
| 7 | C10 RFQ + comparison | 6 | 2 | 50% | 5 | 1.2 | Habit change for buyers |
| 8 | C11 Catalogue | 6 | 1 | 50% | 3 | 1.0 | Compounds over time |
| 9 | C05 Ask | 6 | 1 | 40% | 3 | 0.8 | Nice, not why they pay; high AI-risk surface |
| 10 | C08 Onboarding | 5 | 1 | 50% | 3.5 | 0.71 | Needed once suppliers are in the loop |
| 11 | C09 ТЗ checker | 4 | 1 | 50% | 4 | 0.5 | Unclear willingness to pay |
| 12 | C12 Control Tower core | 3 | 3 | 40% | 10 | 0.36 | Big value, big build, data access unknown |
| 13 | C13 ETA / reroute | 2 | 2 | 30% | 8 | 0.15 | Needs history we don't have yet |
| 14 | C14 Risk Radar | 3 | 1 | 30% | 7 | 0.13 | Alert fatigue risk; licences |

Recommendation: the roadmap order holds. Two deviations to consider: (a) move C05 Ask after C06 (it scores below Supplier 360 and adds AI risk to the first paid audits); (b) pull a thin slice of C06 (BIN lookup + РНУ check) into Phase 1 reports. It's cheap, and the risk flags would make the audits more useful.

## Tech-debt budget
- 20% of each phase's effort is reserved for debt and harness work; the phase gate cannot pass with an open "blocker" debt item.
- Debt accepted in M0 (track in `docs/tech-debt.md` from M1):
  1. Single `pyproject.toml`: no per-module dependency isolation. Revisit when a module needs conflicting deps.
  2. No import-linter yet: module boundaries are convention only. Add in M1.
  3. Web app has no Tailwind/shadcn/app shell: M1.
  4. `httpx` deprecation warning from Starlette TestClient (`httpx2` suggested). Swap in M1 after review.
  5. CI actions pinned by SHA but no Renovate/Dependabot to bump them. Add in M1.
  6. License scan uses pnpm/pip metadata, not ScanCode file-level scan required by `third-party-licenses.md`. Add ScanCode before the first vendored repo.
  7. Health endpoint has no DB check. Add with the DB connection in M1.

## Build vs buy
| Capability | Decision | Option | Why |
|---|---|---|---|
| Auth, Postgres, storage | Buy | Supabase | RLS + auth + storage in one; region/residency to check (Q) |
| LLM | Buy | Claude API behind `services/llm` | Gateway keeps provider swappable |
| Embeddings | Buy or open model | Decide in M2 after eval; model-supply-chain review | Kazakh coverage unknown |
| OCR | Buy first | Cloud OCR or Claude vision via gateway; compare on labelled docs in M6 | Kazakh/Russian stamps, handwriting |
| Sanctions data | Buy | OpenSanctions licence (internal or reseller) | Building lists ourselves is not credible |
| Company registries | Partner | Official access or licensed reseller | No open API found; no scraping |
| Matching, findings, scoring | Build | Our core IP | Deterministic, explainable |
| Event store | Build on Postgres | ADR 0003 | Scale doesn't justify Kafka |
| Queue | Build on Postgres | pgmq / `SKIP LOCKED` (decide M1) | One less system |
| Tracking data | Partner/buy | Per mode; 2 adapters in M6 | Vendor-neutral via contract |
| Email sending | Buy | Transactional email provider (decide M5) | Deliverability |
| PDF | Build | Server-side HTML -> PDF | Same figures as screen |
| Charts | Build on library | Decide in M1 per ui-ux-pro-max chart guidance | Accessibility control |
| Notifications (Telegram) | Build thin | Telegram Bot API | Coordinators live in Telegram (UNVERIFIED, ask in interviews) |
| Billing | Buy | Local payment provider (KZ) | Decide in M8 |
