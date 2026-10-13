---
name: qazsupply-supplier-vetting
description: Summarise whether a supplier can be trusted, with sources and dates, from a QazSupply Supplier 360 dossier. Use with the QazSupply MCP server.
---

# Supplier vetting with QazSupply

Follow `qazsupply-evidence-citation` for every number.

1. `list_suppliers(org_id)` -> find the supplier (match on `data.name` or `bin`).
2. `get_supplier_dossier(org_id, supplier_id)`. If `resolved` is false, say the supplier has no BIN and cannot be screened. If `built` is false, say the dossier has not been built and the user can open it in the app.
3. Lead with `risk.verdict` and `risk.top` (the main reasons), then the facts behind them: registry status and date (`company.fetched_at`, `company.source_id`), ownership (`parties`, `ownership`), screening hits with their human decisions.
4. A screening hit is a possible match, not a fact: report it with its score, the matched words and any decision (`confirmed` / `dismissed` and the reason). Never call a supplier sanctioned unless a hit is `confirmed`.
5. Reading a dossier is logged (it contains owners' personal data). Do not copy owners' names into places the user did not ask for.
6. Mention `sample: true` sources as sample data.
