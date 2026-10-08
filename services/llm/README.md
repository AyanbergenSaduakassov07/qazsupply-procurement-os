# services/llm

The only path to a language model (ADR 0004).

**Public interface:**
- `Gateway(provider, ledger, timeout_s=60, max_retries=2, backoff_s=1).run(org_id=, task=, version=, variables=, model=, max_tokens=) -> Result(text, cost_usd, redacted)`
- Raises `LlmBlocked("blocked_kill_switch" | "blocked_budget")`; provider errors after bounded retries.
- `Provider` protocol (`complete(...) -> Completion`), `Ledger` protocol; `PostgresLedger(conn)` writes `public.llm_calls` (service connection).
- Prompts: `prompts/<task>/<version>.txt`, identified by sha256; variables are redacted (email, phone, IIN/BIN, IBAN, card) and escaped so untrusted text cannot close its `<data>` block.
- Pricing: `pricing.py` (USD per MTok, model table cached 2026-10-06; re-verify before billing on it).

**Order of checks:** kill switch (`LLM_KILL_SWITCH`) -> monthly tenant budget (`organizations.llm_monthly_budget_usd`) -> render -> provider call with timeout + exponential backoff on transient errors -> ledger record (every attempt, including blocked).

**Not built yet (M2):** the Anthropic provider adapter (`anthropic` SDK, default model `claude-opus-5-5`). It lands with the first real prompt and its eval.
