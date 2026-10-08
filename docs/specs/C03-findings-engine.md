# C03. Findings engine (spend analysis)

| Field | Value |
|---|---|
| User | Reviewer (validates); CFO / procurement manager (consumes) |
| Phase | 1 (M2) |
| Dependencies | C01, C02, Evidence model |
| Regulatory flag | Savings claims must be defensible; wording reviewed (no guarantee of savings) |

**Job:** "Show me where we overpay, with proof."

**Detectors (v1):** same-Item price variance across suppliers and time; repeat purchases to consolidate; split purchases under approval thresholds; supplier concentration (Pareto/HHI); outliers vs own history.

**Acceptance criteria**
1. Each Finding: type, detector version, saving estimate + method text, confidence, >= 1 Evidence id.
2. A second independent implementation of savings math; property tests that totals reconcile to source rows.
3. Precision >= 80% on two hand-audited datasets scored by the owner.
4. Thresholds configurable per org with documented defaults.
5. Re-running on the same inputs produces byte-identical Findings (deterministic).

**Data needed:** normalized lines; org thresholds (e.g. procurement approval limits for split detection); FX table.

**AI vs deterministic:** 100% deterministic (SQL/Python). No LLM in any computation.

**Human gate:** every Finding goes through Review (C04) before a client sees it.

**Error states:** too few lines for a detector (state "not enough data"); mixed currencies without FX for date; unit mismatch not convertible.
