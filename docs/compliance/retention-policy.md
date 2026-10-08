# Retention policy (draft)

Status: M0 draft (2026-10-08). Durations are proposals; counsel and the client contract decide. KZ tax and accounting retention periods are UNVERIFIED: confirm before relying on them.

| Data | Default retention | Deletion trigger | Notes |
|---|---|---|---|
| Uploaded client files (raw) | 90 days after report release | Auto-delete; client can delete earlier | Purchase Lines keep source row reference; raw file not needed for Evidence once lines are stored |
| Purchase Lines, Findings, Evidence, Reports | Contract term + 1 year | Contract end + offboarding export | Evidence must stay reproducible while the report is in use |
| Audit log | 5 years (UNVERIFIED vs legal minimum) | Never edited; archived | Hash chain kept intact on archive |
| Personal data (contacts, owners) | While relationship active + 1 year | Request or inactivity | Data-subject requests handled within legal deadline (UNVERIFIED) |
| Screening results | 5 years (AML-style, UNVERIFIED) | Archive | Needed to prove what we knew when |
| ShipmentEvents, Documents | Contract term + statutory period for customs/transport docs (UNVERIFIED) | Contract end | Raw payloads by hash |
| LLM call records (`llm_calls`) | 1 year metadata; no raw prompts by default | Auto | Debug captures (opt-in, redacted) 30 days |
| Application logs | 30 days | Auto | No PII by design |
| Backups | 30 days rolling | Auto | Deleted data disappears from backups within 30 days |
| Eval sets | Until superseded | Manual | Synthetic or consented anonymised data only |

Offboarding: client receives an export (CSV + PDF reports) and a deletion certificate listing what was deleted and what is retained under legal obligation.
