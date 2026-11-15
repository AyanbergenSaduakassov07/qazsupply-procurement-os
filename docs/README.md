# Documentation map

Start here, in this order: [`../README.md`](../README.md) -> [`glossary.md`](glossary.md) (vocabulary) -> [`architecture/domain-model.md`](architecture/domain-model.md).

| Folder | What lives there | Key files |
|---|---|---|
| [`adr/`](adr/README.md) | Architecture decisions, append-only (supersede, never rewrite) | 0001 modular monolith, 0002 RLS tenancy, 0003 event-sourced logistics, 0004 LLM gateway, 0005 connector contract, 0006 reference tables, 0007 M2 matching stack, 0008 M3 review gate + Ask boundary |
| [`architecture/`](architecture/) | How the system is shaped | `domain-model.md` (bounded contexts, events, state machines), `er-m1.md` (ER diagram) |
| [`specs/`](specs/README.md) | One spec per capability: user, flow, acceptance, AI-vs-deterministic split, human gate | C01-C14 core, F01-F09 future |
| [`design/`](design/README.md) | Personas, IA + journeys, design system, tokens + motion, brand voice, fonts, prototypes | `tokens-and-motion.md`, `font-coverage.md` |
| [`security/`](security/threat-model.md) | STRIDE threat model (updated per phase), LLM risk list | |
| [`compliance/`](compliance/) | Data sources register, data classification, retention, third-party licences | `data-sources.md` |
| [`runbooks/`](runbooks/) | How we operate: offboarding and retention purges; (later) incidents and restore drills | `offboarding.md`, `m2-gate-data.md` (what the owner provides for the M2 gate) |
| [`research/`](research/) | Primary-source research, OSS catalogue, per-phase OSS verification | `oss-catalog.md`, `oss-verification-M2.md` |
| [`../evals/`](../evals/README.md) | Eval sets and per-phase eval reports (outside `docs/`, next to the scorers) | `REPORT-M2.md` |
| [`tech-debt.md`](tech-debt.md) | Known shortcuts with owner and trigger to fix | |

Conventions: Markdown, sentence-case headings, no marketing language, every unverified claim marked `UNVERIFIED`.
