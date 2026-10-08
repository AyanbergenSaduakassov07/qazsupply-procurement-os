# packages/agent-skills

QazSupply's own agent skills and MCP tools: what customers' (and our) AI agents can do **inside** the product, safely.

## Contents (planned, built in M3 and published in M9)
```text
packages/agent-skills/
├─ skills/                     # SKILL.md packs, one folder each
│  ├─ spend-audit/             # read a Report, cite Evidence, explain a Finding
│  ├─ supplier-vetting/        # dossier summary with sources and dates
│  ├─ rfq-comparison/          # compare offers, show sensitivity
│  ├─ shipment-triage/         # explain a delay, list options, draft (never send) messages
│  ├─ customs-document-check/  # mismatches between documents and the Order
│  └─ risk-brief/              # alerts affecting this org this week
├─ mcp/                        # MCP server (FastMCP / MCP Python SDK) exposing read-only tools
└─ tests/                      # evals: groundedness, citation rate, injection resistance
```

## Rules
1. Tools are **read-only and tenant-scoped**; nothing sends, signs, awards or pays. Drafts only, with a human approval step in the app.
2. Every numeric claim returns Evidence ids; tools never return raw untrusted text as instructions.
3. Auth: per-organization tokens, least privilege, rate limits, full audit log (agent-security review).
4. Skill patterns may be adapted only from Apache-2.0/MIT sources (for example the open skills in anthropics/skills and mattpocock/skills). The docx/pdf/pptx/xlsx skills in anthropics/skills are source-available: do not copy.
5. Each skill ships with evals (promptfoo/deepeval) and is versioned.
