# M5 eval report: ТЗ checker and analog acceptance (2026-10-13)

## ТЗ checker (`evals/spec_check`, rules only)

| Set | Cases | Extraction P / R / F1 | Issue precision | Issue recall |
|---|---|---|---|---|
| Golden (tuned on) | 26 | 1.00 / 1.00 / 1.00 | 1.00 | 1.00 |
| **Holdout (never tuned on)** | 12 | 1.00 / 0.95 / **0.98** | **1.00** | **0.71** |

Extraction = parameters (comparator, value, unit) and standards. The golden set drove the fixes (an optional parameter name after a comma; "15W-40" is not watts; "3х2,5" keeps 2.5), so its 1.00 is optimistic. The holdout was written after tuning; its first labels mirrored the rules and were corrected to what a human reviewer expects before scoring. Holdout misses: a brand not in the sample list (Lenovo) and a superseded standard cited alone (ГОСТ 10178), plus a unit not in the list (ГБ). Not fixed on purpose: fixing would turn the holdout into a training set.

## Analog acceptance
Measured from reviewer feedback in the product (`GET /orgs/{org}/catalogue-acceptance`, latest decision per pair). **Not measured yet:** there are no reviewers' decisions on real catalogue items; the e2e and integration tests only prove the loop works.

## Comparison engine
Unit and property tests (`services/procurement/test_compare.py`): missing prices, unknown currencies and unconfirmed offers are never ranked; currency mix converts at the offer-date rate; scaling every price by a constant never changes the winner.

## What these numbers do not show
Real Kazakh tender specifications, real brands and standards, and real reviewers. The sample brand/vague/family lists are a start, to be grown from reviewer feedback.
