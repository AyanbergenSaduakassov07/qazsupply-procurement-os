---
name: qazsupply-spend-audit
description: Explain a released QazSupply spend report (Spend X-ray): biggest savings, what to do first, and the rows behind each figure. Use with the QazSupply MCP server.
---

# Spend audit with QazSupply

Follow `qazsupply-evidence-citation` for every number.

1. `list_organizations` -> pick the organization the user means (ask if there are several).
2. `list_reports(org_id)` -> use the newest report with status `released`. Clients only see released reports; do not speculate about drafts.
3. `get_findings(org_id, report_id)` -> rank by `saving_estimate`. For each finding you mention, give its type, the saving with currency and its `evidence_id`.
4. When the user asks "why" or "which rows", call `get_evidence(org_id, evidence_id)` and summarise the computation (`method`) and the source rows (file, row number).
5. A finding with `decision` = `reject` never appears for clients; if you see none, say the report has no kept findings.
6. Recommend next steps only from the finding types (price variance: renegotiate or switch supplier; repeat purchase: consolidate orders; split purchase: check approval limits; concentration: add a second supplier). Never invent prices or suppliers.
