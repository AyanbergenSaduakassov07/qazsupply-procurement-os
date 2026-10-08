# C13. ETA distribution, border queues and reroute

| Field | Value |
|---|---|
| User | Logistics coordinator, procurement manager |
| Phase | 4-5 (M7) |
| Dependencies | C12 event history (>= 50 shipments), BorderNode series (source UNVERIFIED), route graph |
| Regulatory flag | Low; avoid implying guarantees in copy |

**Job:** "How likely is this to arrive by the 17th, and is there a better route?"

**Flow:** route graph from history -> ETA quantiles + P(arrive by date) -> calibration monitoring -> border queue forecast (or "no data") -> reroute candidates scored on cost, time, risk, compliance -> scenario compare -> draft message to carrier (human sends).

**Acceptance criteria**
1. 80% intervals contain actuals 75-85% of the time on time-split holdout, per corridor and mode.
2. Priors labelled as priors in data and UI; insufficient data -> no probability shown.
3. Baseline statistical model first; ML only if it beats baseline on holdout.
4. "What moved this number since yesterday" explanation.

**AI vs deterministic:** statistical/ML models, no LLM predictions. LLM may phrase explanations.

**Human gate:** any reroute decision and message.

**Error states:** new corridor (prior only); queue data missing; model stale.
