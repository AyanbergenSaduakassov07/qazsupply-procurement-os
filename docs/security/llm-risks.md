# Risks the LLM layer introduces (input to llm-top-10 in M2/M3)

Mapped to OWASP Top 10 for LLM Applications 2025 ids. Status: M0 list; each gets tests when the feature that creates it is built.

| # | Risk | OWASP | Where | Planned control |
|---|---|---|---|---|
| L1 | Indirect prompt injection via supplier files, offers, PDFs, emails, news pages, supplier names | LLM01 | C01, C05, C08, C10, C12, C14 | Untrusted text as delimited data; no tools while processing untrusted text; output schema validation; injection suite (>= 50 cases, 0 hijacks gate) |
| L2 | Direct injection in Ask chat | LLM01 | C05 | Read-only tenant-scoped tools; system prompt not secret-dependent; refusal design |
| L3 | Sensitive data sent to provider or leaked across tenants in context | LLM02 | all | Redaction, per-request tenant scoping, no cross-tenant caching of prompts, DPA |
| L4 | Third-party model/embedding/OCR supply chain | LLM03 | C02, C12 | model-supply-chain review, pinned versions, eval before swap |
| L5 | Poisoned golden sets or feedback loops (human corrections, analog accept/reject) | LLM04 | C02, C11, C14 | Reviewer approval before data enters eval/training sets; provenance on labels |
| L6 | Improper output handling: model text rendered as HTML/SQL/commands | LLM05 | C05, C09 | Render as text; never execute model output; structured outputs only |
| L7 | Excessive agency: model sends, awards, blocks, releases | LLM06 | C04, C07, C10, C12 | No write tools; human approval records required (ADR 0004) |
| L8 | System prompt leakage exposes internal rules | LLM07 | C05 | Assume prompts are public; no secrets in prompts |
| L9 | Embedding store leaks or cross-tenant retrieval | LLM08 | C02, C11 | pgvector rows carry org_id + RLS; shared vectors only from public data (ЕНС ТРУ) |
| L10 | Misinformation: invented codes, numbers, legal claims | LLM09 | C02, C05, C06 | Candidates-only selection; uncited numbers blocked; AI labels; human review |
| L11 | Unbounded consumption: cost blow-up, slow responses | LLM10 | all | Budgets, timeouts, kill switch, caching of deterministic steps |
| L12 | Kazakh-language quality gap (model weaker in kk) | LLM09 | C02, C05 | Per-language eval slices; abstain thresholds per language |
