# Documentation map

Start here, in this order: [`../README.md`](../README.md) -> [`../CONTEXT.md`](../CONTEXT.md) (vocabulary) -> [`../ROADMAP.md`](../ROADMAP.md) (phases and gates) -> [`architecture/domain-model.md`](architecture/domain-model.md).

| Folder | What lives there | Key files |
|---|---|---|
| [`adr/`](adr/README.md) | Architecture decisions, append-only (supersede, never rewrite) | 0001 modular monolith, 0002 RLS tenancy, 0003 event-sourced logistics, 0004 LLM gateway, 0005 connector contract, 0006 reference tables |
| [`architecture/`](architecture/) | How the system is shaped | `domain-model.md` (bounded contexts, events, state machines), `er-m1.md` (ER diagram) |
| [`specs/`](specs/README.md) | One spec per capability: user, flow, acceptance, AI-vs-deterministic split, human gate | C01-C14 core, F01-F09 future |
| [`tickets/`](tickets/README.md) | Tracer-bullet tickets for phases 1-3 with status | |
| [`product/`](product/prioritization.md) | RICE, build vs buy | |
| [`discovery/`](discovery/grill.md) | Unknowns ranked by cost of being wrong; open owner questions | |
| [`design/`](design/README.md) | Personas, IA + journeys, design system, tokens + motion, brand voice, fonts, prototypes | `tokens-and-motion.md`, `font-coverage.md` |
| [`security/`](security/threat-model.md) | STRIDE threat model (updated per phase), LLM risk list | |
| [`compliance/`](compliance/) | Data sources register, data classification, retention, third-party licences | `data-sources.md` |
| [`runbooks/`](runbooks/) | How we operate: agent harness boundaries, (later) incidents and restore drills | `agent-harness.md` |
| [`research/`](research/) | Primary-source research, OSS catalogue | |
| [`prompts/`](prompts/README.md) | The M0-M9 build prompts, run in order | `PROGRESS.md` (current stage), `RUN-NEXT.md` (runner) |
| [`tech-debt.md`](tech-debt.md) | Known shortcuts with owner and trigger to fix | |

Conventions: Markdown, sentence-case headings, no marketing language, every unverified claim marked `UNVERIFIED`.
