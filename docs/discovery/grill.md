# Grill: unknowns ranked by cost of being wrong

Source: README, ROADMAP, CONTEXT, M0-M9 prompts, data-sources research (2026-10-08). Only questions the repo can't answer. Cost of being wrong: what breaks or must be rewritten if we guess wrong.

| # | Unknown | Cost if wrong | What it blocks | Default until answered |
|---|---|---|---|---|
| 1 | **Vertical (Q1):** mining vs oil & gas | Very high: golden sets, ЕНС ТРУ families, interview targets, sales story all differ | M2 golden set, Phase 0 interviews | Mining (more private buyers outside KMG's IP perimeter; see Q2) |
| 2 | **KMG IP/confidentiality (Q2)** | Very high: legal exposure; could taint the company | Any use of internship knowledge, any O&G client | Use nothing from KMG; no KMG data, templates or contacts |
| 3 | **ЕНС ТРУ access and licence** | High: matcher (C02) has no target taxonomy | M2 | Mock adapter + "sample data" badge; owner writes to СК-Контракт |
| 4 | **Client type: quasi-state (subject to procurement law) vs private** | High: RFQ flow may be illegal outside goszakup / zakup.sk.kz for quasi-state; split-purchase thresholds differ | C03 thresholds, C10 | Private companies first |
| 5 | **Who builds, hours/week (Q3)** | High: every effort estimate and phase date | RICE effort, roadmap | 1 builder, 20 h/week |
| 6 | **Data residency** for client data (KZ personal data law localisation) | High: hosting region choice is hard to change later | M1 Supabase project region | Pick an option that can be hosted in KZ, or confirm with counsel that personal data stays out (UNVERIFIED) |
| 7 | **Review capacity:** who are the reviewers in Phase 1 | Medium-high: the human gate is the product | C04, SLA | Owner reviews all reports |
| 8 | **Launch languages (Q4)** | Medium: copy and QA effort x3 | M1 shell, M3 report | ru + kk at launch, en second |
| 9 | **Bundled lines (Q5)** | Medium: finding precision | C02/C03 | Flag + exclude from price comparison |
| 10 | **Pricing model for the first audits** | Medium: what "savings" means contractually | Report copy, `verified savings` term | Fixed fee 3-10M KZT, no % of savings in Phase 1 |
| 11 | The QazSupply doc's 12-capability list | Medium: spec set may not match the pitch | Specs | 14 capabilities derived from roadmap |
| 12 | Model provider data terms (DPA, retention, region) | Medium | Any LLM call with client data | Redact before send; zero-retention option if available (UNVERIFIED) |
| 13 | Prototype after design system (Q6) | Low | M1 order | Yes |

Q1-Q6 restated with options and recommendation: see the M0 report (and `ROADMAP.md`, which stays the source of truth for decisions once answered).
