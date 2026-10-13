# OSS verification: M5 (2026-10-13)

Checked with the GitHub API (exists, archived, licence, last push); licence text read where GitHub says NOASSERTION. Decision rule: keep a repo only if it beats the simplest alternative for M5's scope.

| Repo | Catalogue licence | GitHub licence | Archived | Last push | Decision | Reason |
|---|---|---|---|---|---|---|
| meilisearch/meilisearch | MIT + BUSL-1.1 (EE) | NOASSERTION; LICENSE: "Part of this work fall under the Meilisearch Enterprise Edition (EE) ... BUSL 1.1 ... The other parts ... MIT" | false | 2026-10-12 | deferred (S) | The prompt says Postgres first. Local Postgres has `pg_trgm` 1.6, `unaccent` 1.1 and `vector` 0.8.2: trigram similarity covers typos and kk/ru spelling variants without a sidecar. Spike trigger: catalogue search p95 > 150 ms at 10k entries, or the typo eval below target. If adopted: MIT core only, EE features never enabled (BUSL). |
| inventree/InvenTree | MIT | MIT | false | 2026-10-13 | R | Data-model reference for parts, supplier parts and purchase orders. Ideas mirrored into CONTEXT terms; no code copied. |
| apache/ofbiz-framework | Apache-2.0 | Apache-2.0 | false | 2026-10-13 | R | RFQ and quote flows read for state names; no code. |
| frappe/erpnext | GPL-3.0 | GPL-3.0 | false | 2026-10-13 | R (study only) | Copyleft. Request-for-quotation / supplier-quotation flow studied; nothing copied. |
| odoo/odoo | LGPL | NOASSERTION (LGPL-3 per repo) | false | 2026-10-13 | R (study only) | Purchase agreement / call-for-tender flow studied; nothing copied. |
| typesense/typesense | GPL | GPL-3.0 | false | 2026-10-13 | R (study only) | Copyleft search engine; not used. |

Embedding-based analog search (pgvector) is deferred: it needs an embedding model, which means either a paid API or a local model with a model-supply-chain review; the owner chose free tools only. Analog search in M5 is attribute-aware plus trigram (D38).

Nothing new is vendored or installed for M5 so far.
