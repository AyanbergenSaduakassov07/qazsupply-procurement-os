# 0004. LLM gateway and "the LLM never computes numbers"

- Status: proposed
- Date: 2026-10-08
- Deciders: Ayanbergen Saduakassov

## Context
LLMs help with text: mapping item text to codes, extracting fields from documents, summarising, explaining. They are unreliable at arithmetic, can be prompt-injected by supplier files and news, and every call sends data to a third party (cost, privacy).

## Decision
All model calls go through `services/llm` (one public function per task type, e.g. `rerank_items`, `extract_document_fields`, `summarise_with_citations`). The gateway: versioned prompt templates (stored as files, hashed), PII/commercial redaction before send, structured output validated against a schema, per-tenant and global budgets, timeouts + bounded retries, a kill switch (`LLM_KILL_SWITCH`), and an `llm_calls` record (prompt version, model, tokens, cost, redaction flag, latency; no raw content by default). Rules: (1) no figure shown to a user is produced by a model; numbers come from SQL/Python with Evidence ids, and uncited numbers in model output are blocked server-side; (2) untrusted text is passed as data in delimited fields, never as instructions, and the model has no tools when processing it; (3) the model chooses only among candidates we retrieved (e.g. ЕНС ТРУ codes), never invents codes; (4) models never send, approve, award or decide.

## Alternatives considered
- Direct SDK calls from each module: no central redaction, budgets or audit; impossible to kill-switch.
- Third-party LLM proxy (LiteLLM etc.): adds a dependency for a thin layer we need to own for redaction and Evidence rules; reconsider if we go multi-provider.

## Consequences
- Every LLM feature needs a golden set and eval before launch (`evals/`).
- Model/provider changes are one-module changes plus an eval rerun.
- Monitor: cost per 1k lines, refusal/abstain rates, injection-suite hijack rate (target 0).
