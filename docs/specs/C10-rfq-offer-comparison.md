# C10. RFQ workflow and offer comparison

| Field | Value |
|---|---|
| User | Procurement manager (runs), CFO (approves large), supplier (responds) |
| Phase | 3 (M5) |
| Dependencies | C06/C07 (supplier risk), C09, C11, LandedCost interface (C12 later), notifications, email |
| Regulatory flag | External messages; for quasi-state clients, public procurement law may require goszakup/zakup.sk.kz instead (UNVERIFIED) |

**Job:** "Run a quote round in days not weeks, and have a decision record that survives an audit."

**Flow:** draft RFQ (template, autosave) -> internal approval -> human approves send -> suppliers respond via portal / email / PDF -> extraction -> supplier confirms extracted numbers -> normalized comparison matrix (price, payment terms, lead time, landed-cost estimate, supplier risk) -> client-weighted scoring + sensitivity view -> decision record.

**Acceptance criteria**
1. Nothing is sent without a recorded human approval on that RFQ version.
2. Extracted offer numbers are confirmed before comparison.
3. Comparison handles missing price, currency mix (dated FX), unit mismatch with visible notes.
4. Sensitivity: "if lead time mattered 2x, winner changes to X".
5. Decision record: who, what, why, alternatives; one-click export.
6. 20+ RFQs completed in-product for Gate B.

**AI vs deterministic:** scoring and normalization deterministic; extraction and drafting by LLM.

**Human gate:** send, award. AI never selects a winner.

**Error states:** supplier misses deadline; offer in unexpected format; offer revision after close.
