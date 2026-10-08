# C14. Risk Radar

| Field | Value |
|---|---|
| User | Procurement manager, logistics coordinator, CFO (digest) |
| Phase | 5 (M7) |
| Dependencies | news connector (licences), entity linking to Suppliers/Routes/BorderNodes/Items, notifications |
| Regulatory flag | Copyright on news text (store links + facts); defamation risk on supplier-linked alerts |

**Job:** "Tell me early when something in the world will hit my suppliers or shipments, and stay quiet otherwise."

**Flow:** ingest licensed/open sources -> dedupe/cluster -> entity linking with confidence -> relevance score -> alert policy (instant vs digest, per-user budget) -> alert center with feedback -> evals.

**Acceptance criteria**
1. >= 70% alerts rated useful in a 4-week pilot; < 3 false alerts/user/week.
2. No alert without a source link.
3. Ingested pages are untrusted (injection suite extended to web pages): 0 hijacks.
4. Single pipeline unless multi-agent is justified in writing.

**AI vs deterministic:** LLM for entity extraction and summary (with links); relevance scoring model + rules; budgets deterministic.

**Human gate:** none to receive; any action on a supplier is human.

**Error states:** source feed down; duplicate storm; low-confidence link (goes to digest, not instant).
