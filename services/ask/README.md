# services/ask

Ask (M3, spec C05): one cited answer about one released report.

**Public interface:** `services.ask.api`
- `load(conn, org_id, report_id) -> Context(head, findings)`: under the caller's RLS. Raises `AskDisabled` (org has not opted in), `NotReleased`, `LookupError` (report not visible). Call it in a short transaction and release the connection before the model call.
- `answer_from(head, findings, question, history, runner=, model=, locale=, org_id=) -> Answer(answerable, sentences[{text, evidence_ids, cites_report}], dropped, numbers_total, numbers_cited)`: the DB-free core, used by the route and by `evals/ask`.

**How it stays honest (ADR 0008):**
- **No tools.** The server loads the report's kept findings (at most 60, highest saving first) into the prompt as escaped `<data>`, referenced as `F1..Fn`. No UUIDs, BINs or raw purchase rows leave the boundary. Untrusted text never gets tool access (CLAUDE.md rule 5).
- **Validation before display** (`validate.check`): a sentence survives only if every id it cites was given, every number equals a figure of what it cites (a percentage only backs `N%`; digits inside cited names are names), and it has no link. Everything else is dropped and counted.
- **Refusal is an answer:** `answerable: false` renders as the designed "I can't answer that from your data" in the UI, not an error.
- Calls go through `services.llm` (prompt `ask/v1`, redaction, budget, kill switch). No database connection is held during the model call: the ledger (`PooledLedger`) borrows a service connection per short write, so failed and blocked calls are still recorded.

**Context budget:** instructions ~450 tokens + report line ~60 + <= 60 findings x ~45 + last 4 turns x 400 chars + question <= 500 chars; output <= 700 tokens.
