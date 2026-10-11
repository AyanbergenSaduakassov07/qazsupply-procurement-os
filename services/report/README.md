# services/report

Report model and the review workflow (M3); PDF export lands later in M3.

**Public interface:** `services.report.api`
- Read: `list_reports`, `get_report` (gate state: status, submitted/approved/released by and at, undecided findings, total kept saving, `four_eyes`), `reviews` (decision history).
- Workflow (staff only, else `NotStaff`): `submit`, `return_to_draft`, `decide_finding(decision, note)`, `approve(note)`, `reject(note)`, `reopen`, `release`. A refused step raises `GateError(code)` with the database's reason, e.g. `undecided_findings`, `note_required`, `four_eyes_approver_cannot_release`.

**Where the rules live:** the database (`infra/supabase/migrations/20261012000000_m3_review_gate.sql`, tested in `infra/supabase/tests/m3_review_gate.test.sql`). Reports move only draft -> in_review -> approved -> released (or rejected / superseded). Approval needs a decision on every finding plus a signed approval review. Release stamps the caller. Findings freeze once a report leaves draft. Clients see released reports only, and never rejected findings, their evidence or their notes. Notes on kept findings are client-visible. Every step is written to the audit chain by the database itself.
