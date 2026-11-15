# 0011. M5 Procurement OS: DB-enforced RFQ lifecycle, rules-only ТЗ checker, Postgres search

- Status: accepted
- Date: 2026-10-13
- Deciders: Ayanbergen Saduakassov

## Context
M5 runs a purchase from specification to decision record. The design forbids auto-send and auto-award, requires supplier confirmation of extracted numbers, a weighted comparison with sensitivity, and a catalogue with forgiving search and private/shared boundaries. Free tools only.

## Decision
1. **Lifecycle in the database** (like the M3 review gate): approval per version, a human records "sent", offers append-only, confirmation by the supplier (portal) or a named buyer with a note, decision by approvers only after close, all audited.
2. **No outbound channel at all.** QazSupply never emails suppliers; the portal is pull-only. "Sent" is a person's record.
3. **ТЗ checker is rules-only** (regexes + sample knowledge lists), measured on a golden set and an untuned holdout. A model may later draft suggestions, never numbers.
4. **Comparison is pure Python**, min-max normalised, client weights, sensitivity at 2x/0.5x per criterion; landed cost is an explicit M6 placeholder.
5. **Catalogue search on Postgres** (`pg_trgm` + folded Kazakh letters). Meilisearch deferred (trigger: p95 > 150 ms at 10k entries or typo eval below target). Embedding analogs deferred (D38).
6. **Shared prices**: opt-in, k >= 5 organizations, aggregate only, function not exposed through PostgREST.

## Consequences
Every gate is a person and leaves an audit row. Analog acceptance and RFQ cycle time can only be measured with real use (Gate B).
