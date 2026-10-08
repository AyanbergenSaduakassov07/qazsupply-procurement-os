# C04. Report and review gate

| Field | Value |
|---|---|
| User | QazSupply reviewer (approves); CFO / auditor (reads); procurement manager |
| Phase | 1 (M3) |
| Dependencies | C03, Evidence drawer, PDF export, audit log |
| Regulatory flag | Advisory output; liability wording reviewed by counsel; reviewer named on report |

**Job:** CFO: "A report I can defend in front of my board." Reviewer: "Approve 40 findings in an hour without missing a bad one."

**Flow:** FindingsComputed -> draft Report -> reviewer console (apps/review): per-finding approve / edit / reject + note, diff of edits, SLA timer -> approve -> release -> client notified -> client reads web report and PDF.

**Acceptance criteria**
1. An unreleased Report is unreachable by client roles: tested at DB (RLS), API and UI.
2. Every number opens the Evidence drawer (source rows, method, confidence, reviewer).
3. PDF figures equal screen figures exactly; PDF footer has report id, reviewer, date.
4. Report narrative: headline saving -> top findings by money x confidence -> drill-down -> recommended actions.
5. kk / ru / en with locale number, date and currency formats.
6. Every reviewer action writes an audit log entry.

**AI vs deterministic:** figures deterministic. AI may draft finding explanations from Evidence (labelled, reviewer-edited).

**Human gate:** release requires a named reviewer approval. AI never releases.

**Error states:** reviewer edits a figure (not allowed: they edit text or reject; figures change only by recomputation); finding invalidated by re-upload (report goes back to draft).
