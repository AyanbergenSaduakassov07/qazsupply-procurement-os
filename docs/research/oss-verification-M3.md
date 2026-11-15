# OSS verification: M3 (2026-10-12)

Checked with the GitHub API: repository exists, archived flag, licence (SPDX as GitHub detects it), last push, and whether the pinned SHA from `docs/research/oss-catalog.md` still resolves. Decision rule (M3 OSS task 2): keep a repo only if it beats the simplest alternative for M3's scope. Every deferral names the trigger to revisit it.

| Repo | Catalogue licence | GitHub licence | Archived | Last push | Pin resolves | Decision | Reason |
|---|---|---|---|---|---|---|---|
| diegomura/react-pdf | MIT | MIT | false | 2026-10-07 | yes (`e7b14db1e5`) | **ADOPTED (D)** | `@react-pdf/renderer@4.9.0` renders the report PDF on the server from the same model as the screen. Proven by e2e (PDF figures = screen figures; Kazakh text extracts from the kk PDF). |
| airbnb/visx | MIT | MIT | false | 2026-06-22 | yes (`485c035966`) | dropped (M3) | The one M3 chart (savings by type, Pareto) is the existing recharts component with a table alternative. Revisit for custom dot/range plots (M6 ETA bands). |
| apache/echarts | Apache-2.0 | Apache-2.0 | false | 2026-10-04 | yes (`34f4d927ea`) | dropped (M3) | Same reason; a second chart library would double bundle size for one chart. |
| assistant-ui/assistant-ui | MIT | MIT | false | 2026-10-11 | yes (`6ca5ca4080`) | dropped (M3) | Ask answers arrive validated and whole (no token streaming, no tool UI). A ~200-line panel on our design system is enough and keeps the nonce CSP simple. |
| vercel/ai | Apache-2.0 | NOASSERTION | false | 2026-10-11 | yes (`5028fa46b4`) | dropped (M3) | Token streaming conflicts with validate-before-display (ADR 0008): figures must be checked before anyone sees them. GitHub no longer detects a licence: re-check the LICENSE file before any future use. |
| anthropics/claude-agent-sdk-python | MIT | MIT | false | 2026-10-09 | yes (`f7b0b62c2a`) | dropped (M3) | Ask has no agent loop and no tools (ADR 0008; docs/design/design-system.md rule 5). Revisit for the agent-ready API / MCP work. |
| pydantic/pydantic-ai | MIT | MIT | false | 2026-10-11 | yes (`f55bb8a6fd`) | dropped (M3) | Same reason as the agent SDK. |
| jlowin/fastmcp | Apache-2.0 | Apache-2.0 | false | 2026-10-11 | yes (`5baeacfe20`) | deferred | The agent-ready MCP API (M3 tie-in) is not built in this phase: see "Not done" in PROGRESS. Revisit when it starts. |
| modelcontextprotocol/python-sdk | MIT | MIT | false | 2026-10-11 | yes (`91941ed4d3`) | deferred | Same as fastmcp. |
| exceljs/exceljs | MIT | MIT | false | 2025-01-21 | yes (`5bed18b45e`) | deferred | No Excel export in M3; the repo is stale (no push since 2025-01). Revisit if clients ask for xlsx export. |
| explodinggradients/ragas | Apache-2.0 | Apache-2.0 | false | 2026-02-24 | yes (`298b682742`) | deferred | Groundedness is enforced deterministically (every number checked against what it cites) and measured by `evals/ask` (`grounded`, `citation_coverage`). Revisit when an LLM judge scores free-text explanations. |
| NVIDIA/garak | Apache-2.0 | Apache-2.0 | false | 2026-10-10 | yes (`aa5262f13d`) | deferred | `evals/ask` runs 64 targeted injections (4 vectors, 5 kinds) in obedient and live modes. Revisit to broaden the red-team against the production Claude adapter. |
| promptfoo/promptfoo | MIT | MIT | false | 2026-10-11 | yes (`bbb583afc8`) | deferred | Same as garak. A CI red-team needs paid model calls on every PR. |
| protectai/llm-guard | MIT | MIT | **true** | 2026-07-08 | yes (`168c1034ff`) | **dropped (archived)** | Archived upstream. Input/output scanning is covered by our redaction (`services/llm/redact.py`) and the answer validator. |
| sigex-kz/ncalayer-js-client | MIT | MIT | false | 2026-06-12 | yes (`85faf4d5df`) | deferred | EDS sign-off needs counsel's view of its legal effect FIRST (M3 prompt). The audit-log approval is the fallback in use. |
| anthropics/claude-cookbooks | MIT | MIT | false | 2026-10-10 | yes (`d7265d6ae9`) | R | Read for citation patterns; no code copied. |
| guardrails-ai/guardrails | Apache-2.0 | Apache-2.0 | false | 2026-10-09 | yes (`06d0ff2c5f`) | R | Validator idea only; our validator is about 130 lines with unit and property tests. |
| NVIDIA/NeMo-Guardrails | Apache-2.0 | NOASSERTION | false | 2026-10-10 | yes (`9f793de53e`) | R | Reference only; GitHub no longer detects a licence. |

New dependencies added in M3 outside the catalogue: `@ibm/plex-sans@1.1.0` (OFL-1.1, the product font embedded in PDFs; exception proposed in harness PR #4) and `pdfjs-dist@6.3.289` (Apache-2.0, e2e dev dependency for PDF text extraction).
