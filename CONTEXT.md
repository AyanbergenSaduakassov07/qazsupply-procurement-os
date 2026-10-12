# CONTEXT: QazSupply domain language

Use these terms exactly in code, docs, UI copy and prompts. Update via the `domain-modeling` skill. Status: **sharpened in M0 (2026-10-08), extended in M2/M3, pending owner review.** Bounded contexts: `docs/architecture/domain-model.md`.

Conventions: every client-data entity carries `org_id` (its Organization). "Invariant" = must hold in every committed state; each one gets a test (DB constraint, RLS test, or property test).

## Tenancy and people
- **Organization:** a client company; the tenant. *Invariants:* every client-data row has exactly one `org_id`; no read or write crosses Organizations (RLS, tested per policy); QazSupply staff access a tenant only through a logged `qazsupply_admin`/`reviewer` membership.
- **Membership:** a user's role in one Organization. Roles: `client_admin`, `client_user`, `reviewer`, `qazsupply_admin`, `supplier`. *Invariant:* a user can hold different roles in different Organizations; permissions are evaluated per (user, org).

## Spend X-ray
- **Upload:** one client file (xlsx/csv) with its sha256. *Invariant:* the same hash in the same Organization is ingested once (idempotent).
- **Purchase Line:** one row of historical spend: item text, quantity, unit, unit price, currency, date, supplier text, source Upload + row number. *Invariants:* always traceable to Upload + row; original values are kept beside normalized ones; never edited in place (corrections are new versions).
- **Review queue:** Purchase Lines the matcher sent to a human (`match_status` review or bundled). Decisions are accept / choose / reject / undo. *Invariant:* every decision is written to **Match feedback** (append-only, reviewer = the signed-in user); feedback becomes eval data only after review.
- **Sample classifier:** the synthetic stand-in for ЕНС ТРУ (codes `SYN-*`) used until real access exists. *Invariant:* always shown with a "sample" badge; never presented as real classifier data.
- **Rate date:** the National Bank rate date actually used to convert a line to KZT (nearest published date on or before the purchase date). Stored on the line; shown in Evidence.
- **Analysis run:** one execution of the detectors for an Organization, identified by a `computation_id`; produces a draft Report. *Invariant:* the money is recomputed by an independent SQL implementation and the run writes nothing if they disagree.
- **Item:** a normalized product or service identified by an ЕНС ТРУ code (later: HS code for imports). *Invariant:* a Purchase Line maps to 0 or 1 Item, with a confidence and method (`exact`, `lexical`, `embedding+rerank`, `human`).
- **Bundled line:** a Purchase Line that contains several Items in one row. Default (Q5): flagged, excluded from price comparison, split only by a human.
- **Supplier:** a legal entity that sells, resolved from names and BIN/IIN. *Invariants:* merges are reversible and logged; a Supplier without BIN is "unresolved" and is never screened as if resolved.
- **Finding:** a detected issue with a money impact: `price_variance`, `repeat_purchase`, `split_purchase`, `concentration`, `outlier`. *Invariants:* has detector + version, saving estimate + method, confidence, and >= 1 Evidence id; computed by SQL/Python only.
- **Evidence:** the link from a displayed figure to its source rows and the computation that produced it (computation id + inputs + code version). *Invariant:* no figure reaches a client (screen, PDF, chat) without one; recomputing from Evidence reproduces the figure exactly.
- **Report:** a versioned set of Findings for one Organization and period. States: `draft -> in_review -> approved -> released` (or `rejected`). *Invariant:* invisible to client roles until `released`; release requires an approving Review; enforced at DB, API and UI.
- **Review:** a named human's decision (`approve`, `edit`, `reject`) on a Finding or Report, with a note. Append-only; logged in the audit log. *Invariants (M3, enforced in the database):* a Report is approved only when every Finding has a decision and the approver signed a report-level approval; approval and release are two steps; a rejected Finding, its Evidence and its note never reach a client; `edit` and `reject` need a note.
- **Two-person rule (`four_eyes`):** per-Organization switch, set only by a QazSupply admin. When on, whoever ran the analysis cannot approve it and the approver cannot release it.
- **Ask:** the read-only, tenant-scoped chat over Findings and Evidence. *Invariants:* off until the Organization opts in (`ask_enabled`, admins only); answers only about released Reports; every numeric claim cites Evidence ids and equals a figure of what it cites; any sentence that fails the check is dropped before display, never shown (ADR 0008).

## Supplier 360 and compliance
- **Party:** any person or entity in a chain (supplier, owner, carrier, consignee, bank). A Supplier is a Party.
- **BeneficialOwner:** a natural person who ultimately owns or controls a Party (threshold per KZ AML rules; UNVERIFIED, counsel to confirm). Personal data: minimised, access-logged.
- **Screening:** a sanctions / PEP / dual-use / registry check on a Party or Item at a point in time, against a dated source version. *Invariants:* a hit never auto-blocks; a human confirms or dismisses with a reason code; every result records source, source version and timestamp.
- **Dossier:** the Supplier 360 page: verdict strip, risk factors, evidence tabs. *Invariant:* every claim has a source link + date; AI summaries are labelled AI-generated.
- **Risk score:** rules-first, transparent weighted factors, editable per Organization. Not a credit rating.
- **Verdict:** the Dossier's headline: `ok`, `caution`, `high_risk` or `unknown`, from the Risk score. *Invariants:* a confirmed sanctions hit is always `high_risk`; a supplier that was never built or screened is `unknown`, never `ok`; shown as icon + words.
- **Hit decision:** a human's `confirmed` / `dismissed` on one screening hit, with a reason code (and a note for `other`). Append-only; the latest decision counts; audited.
- **Sample source:** a connector serving invented data until real access exists. *Invariant:* every row it produces carries `sample = true` and the UI shows a "Sample data" badge.
- **Onboarding case:** a buyer's request that one supplier user completes: `invited -> in_progress -> submitted -> approved | rejected` (or returned to `in_progress` with a note). *Invariants:* the supplier sees only its own case and cannot decide; buyers cannot rewrite what the supplier declared; approval is a named human's and starts a screening.

## Procurement OS
- **Spec (ТЗ):** a technical specification for a purchase. The ТЗ checker flags ambiguity, brand-locking, missing parameters.
- **RFQ:** a request for quotes, versioned. States: `draft -> approved -> sent -> collecting -> closed -> decided` (or `cancelled`). *Invariant:* nothing is sent without a human approval recorded on that version.
- **Offer:** a Supplier's response to an RFQ. *Invariant:* extracted numbers are confirmed by the Supplier (or a human) before they enter comparison.
- **Decision record:** who chose which Offer, why, and which alternatives were considered. Append-only.
- **Order:** a confirmed purchase linking Items, Supplier, terms (Incoterms, payment) and zero or more Shipments.
- **Catalogue entry:** an Item with attributes, units, standards and price history (source + date). Shared aggregates only with consent and k-anonymity (k >= 5 default; UNVERIFIED as sufficient).

## Logistics
- **Shipment:** goods moving under one Order (or part of it). Has ordered Legs. State is derived from ShipmentEvents (see state machine in `docs/architecture/domain-model.md`).
- **Leg:** one segment with a mode (`road`, `rail`, `sea`, `air`), a Carrier, origin and destination nodes, planned and actual times.
- **Route:** a path through a graph of nodes (terminals, ports, BorderNodes) and edges (leg templates with historical duration and cost distributions).
- **BorderNode:** a crossing or terminal with a queue-time series. *Invariant:* "no data" is a first-class state, never interpolated silently.
- **ShipmentEvent:** an append-only fact about a Shipment: type, occurred_at, recorded_at, source, confidence, raw-payload reference (sha256). *Invariants:* never updated or deleted; idempotent by (source, source_event_id); replaying the same stream yields identical state; conflicts resolved by the documented rule (ADR 0003).
- **Document:** invoice, packing list, CMR, SMGS/CIM, BL, AWB, certificate, customs declaration, ЭСФ/СНТ. Lifecycle: `received -> extracted -> confirmed -> cross_checked -> (accepted | mismatch -> resolved)`; versioned; supplier/carrier documents are untrusted input.
- **Carrier:** a company moving goods (trucking, rail, shipping line, forwarder). A Party.
- **LandedCost:** goods + freight + duties/VAT + insurance + financing, computed with an Evidence trail. Duty/tax rules are dated data with sources.
- **ETA distribution:** a probabilistic arrival estimate (quantiles and P(arrive by date)); never a single date. Priors are labelled as priors.
- **Alert:** a Risk Radar or exception notice linked to Suppliers, Orders, Routes or Shipments. *Invariants:* always has a source link; has severity, owner and state (`open`, `snoozed`, `resolved`, `dismissed` with feedback).
- **Exception:** an Alert on a specific Shipment requiring action (delay, damage, held at border, document rejected, sanctions hit).

## Platform
- **Connector:** an adapter for one external source behind `connectors/_contract`; emits SourceRecords (source id, fetched_at, licence, payload, raw sha256). Listed in `docs/compliance/data-sources.md` first.
- **LLM call:** a request through `services/llm` only; recorded with prompt version, model, tokens, cost, redaction flag.
- **Audit log:** append-only, hash-chained record of every human and system action that changes client-visible state.

## Open terms (owner to define; see `docs/discovery/grill.md`)
Group purchase, batch passport, honest rating, inspector, price index, "verified savings" (needed for the % of savings revenue line).
