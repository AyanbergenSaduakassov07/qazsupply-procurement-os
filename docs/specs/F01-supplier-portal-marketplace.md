# F01. Supplier portal and marketplace (future)

| Field | Value |
|---|---|
| User | Supplier sales rep; buyers |
| Phase | 6 (M8) |
| Dependencies | C08, C10, C11, billing |
| Regulatory flag | Platform terms; e-commerce/consumer rules do not apply (B2B) but marketplace liability does (counsel) |

**Job:** "Find buyers whose tenders match what I sell, and respond fast."
**Flow:** profile, catalogue, certificates, capability tags -> tender feed matched with fit score + "why this matches" -> offer submission -> subscription billing.
**Acceptance:** 30+ active suppliers; no pay-to-rank; buyer data never visible to suppliers beyond the RFQ they were invited to.
**AI vs deterministic:** fit score rules + embedding; LLM explains match.
**Human gate:** supplier submits offers; buyer invites.
