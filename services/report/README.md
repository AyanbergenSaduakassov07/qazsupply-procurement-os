# services/report

Report model, review workflow, PDF export (M3).

**Public interface (M1):** `services.report.api.list_reports(conn, org_id)`. Client roles see only `released`/`superseded` reports (RLS); reviewers and QazSupply admins see every state.
