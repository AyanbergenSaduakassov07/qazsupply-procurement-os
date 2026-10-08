# C05. Ask: cited chat over the client's data

| Field | Value |
|---|---|
| User | CFO, procurement manager |
| Phase | 1 (M3) |
| Dependencies | C04 (released reports only), Evidence, LLM gateway, tool-design |
| Regulatory flag | Data sent to model provider: DPA and redaction (ai-data-privacy) |

**Job:** "Ask 'why did we pay more for cable in Q2?' and get an answer I can check."

**Flow:** global Ask entry -> question -> model plans with read-only, tenant-scoped tools (get_findings, get_evidence, aggregate_spend with fixed parameters) -> answer with citation chips -> chip opens Evidence drawer.

**Acceptance criteria**
1. >= 95% of numeric claims cited; uncited numbers blocked server-side before display.
2. "I can't answer that from your data" is a designed answer, not an error.
3. No free-form SQL from user text; tools have fixed schemas.
4. Injection suite (>= 50 attacks via supplier names, cells, PDFs, chat): 0 hijacks.
5. Only released Reports and their Evidence are in scope.

**AI vs deterministic:** LLM plans and phrases; tools compute; numbers come from tools only.

**Human gate:** none per answer (read-only); feedback buttons feed evals.

**Error states:** budget exhausted; kill switch on; question outside scope; tool timeout.
