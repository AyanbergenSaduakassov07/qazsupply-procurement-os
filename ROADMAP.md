# ROADMAP: 5 years, gates not dates

A phase ends only when its gate passes. Failing a gate means fixing quality, not starting the next phase.

## Progress
Live stage, gate evidence and next prompt: [`docs/prompts/PROGRESS.md`](docs/prompts/PROGRESS.md). This file keeps phases and gate definitions only.

| Phase | Product | Prompt | Exit gate |
|---|---|---|---|
| 0. Validate (weeks 0-4) | Interviews, one manual audit | none | >=5/15 interviewees confirm the pain; >=3% savings found; a client agrees to pay or share data |
| 1. Spend X-ray (to month 3) | Upload, ЕНС ТРУ matching, findings, reviewed PDF, cited chat | M0, M1, M2, M3 | >=90% matcher top-1; >=80% finding precision; 3 paid audits |
| 2. Supplier 360 (to month 6) | Dossiers, sanctions and beneficial-owner screening, onboarding | M4 | Zero known false negatives on the labelled sanctions set; used in 5+ purchase decisions |
| 3. Procurement OS (to month 10) | RFQ, offer comparison, ТЗ checker, catalogue | M5 | 20+ RFQs run in-product; measurable cycle-time drop |
| 4. Logistics Control Tower (to month 16) | Shipments, documents, tracking, ETA probability, reroute | M6, M7 | ETA calibration within +-10 pts at the 80% level; 50+ live shipments |
| 5. Risk Radar (to month 20) | News/event ingestion linked to suppliers, orders, routes | M7 | >=70% alerts rated useful; <3 false alerts per user per week |
| 6. Marketplace and Fintech (to year 3) | Supplier portal, group buys, negotiation assistant, financing, insurance, batch passport | M8 | Supplier revenue; first sandboxed financed deal; lawyer-confirmed regulatory path |
| 7. Regional network (year 3-5) | Uzbekistan, Kyrgyzstan, uz/kk/ru/en, price index, forecasting | M9 | Second country at positive unit economics |

## Revenue ladder
Spend audit fee (3-10M KZT) -> subscription -> % of verified savings -> deal commission -> supplier subscription -> finance referral fees.

## Open decisions
- **Q1** Vertical: mining vs oil and gas (recommendation: pick one, defer the other).
- **Q2** KMG internship IP/confidentiality: check terms before using any related knowledge.
- **Q3** Who builds, and how many hours per week.
- **Q4** UI languages at launch (recommendation: ru + kk first, en second).
- **Q5** Bundled lines (recommendation: split or flag).
- **Q6** Build the clickable prototype after the design system (recommendation: yes).

## UNVERIFIED (confirm in M0)
MCP install commands; goszakup, data.egov.kz and OpenSanctions access terms; every logistics data vendor; Kazakh-Cyrillic font choice.
