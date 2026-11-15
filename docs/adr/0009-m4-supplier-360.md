# 0009. M4 Supplier 360: sample adapters, rules-first verdict, DB-enforced onboarding

- Status: accepted
- Date: 2026-10-12
- Deciders: Ayanbergen Saduakassov (owner override to start M4 before Gate A, 2026-10-12)

## Context
M4 must answer "can I trust this supplier?" with sources and dates, screen parties and goods, and onboard suppliers safely. No real source is reachable yet: no goszakup token, no data.egov.kz key, no registry agreement, no OpenSanctions licence (screening is commercial use; bulk data CC BY-NC). The owner asked for free tools only.

## Decision
1. **Sample adapters** behind the connector contract for registries, goszakup (РНУ), OpenSanctions and dual-use, with invented data, a `sample` flag on every cached row and screening, and a UI badge. Failures are typed (`connectors/outage.py`) and shown, never hidden.
2. **Screening matcher**: our own explainable matcher (Latin skeleton for kk/ru/en/Kazakh Latin, patronymic folding, one-to-one token alignment with RapidFuzz). rigour (PyICU) failed to install; jellyfish is English-phonetic. Threshold 80, chosen recall-first on `evals/screening` (zero misses from 75 to 82; zero false positives from 80).
3. **A hit never blocks.** Decisions (confirm/dismiss) are append-only with mandatory reason codes; client admins and QazSupply staff decide; every run and decision is audited.
4. **Rules-first verdict**: ten named factors with visible weights, per-org overrides (admins), confirmed sanctions always high risk, missing data always `unknown`. No model touches the verdict; the AI summary is deferred (D31).
5. **Onboarding state machine in the database** (same pattern as the M3 review gate). Supplier documents are stored in Postgres (bytea, 5 MB cap) and served only as attachments. No OCR: the supplier types and confirms the fields (D29).
6. Ownership graph is our own layered layout of HTML buttons over an SVG edge layer plus a table view; cytoscape/sigma dropped (canvas content is invisible to screen readers; graphs are tens of nodes).

## Alternatives considered
yente sidecar with OpenSanctions data (needs the licence); third-party graph libraries; object storage for documents (no remote project yet, D8).

## Consequences
Everything shown is reproducible and explainable, but nothing is real data: the M4 acceptance items "20 real suppliers profiled" and "5+ real purchase decisions" stay open. Replacing a sample adapter is a connector change plus a re-run of `evals/screening` on a real labelled set.
