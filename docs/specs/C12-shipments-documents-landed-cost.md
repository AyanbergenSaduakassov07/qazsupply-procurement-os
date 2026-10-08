# C12. Shipment record, documents and landed cost (Control Tower core)

| Field | Value |
|---|---|
| User | Logistics coordinator (phone-first), procurement manager, CFO (landed cost) |
| Phase | 4 (M6) |
| Dependencies | Orders (C10), connectors (carriers, rail, ais, customs, ИС ЭСФ), event store (ADR 0003), OCR, C07 |
| Regulatory flag | Customs data; client carrier credentials; ЭСФ access only with client consent |

**Job:** "Know where every shipment is, what is wrong, and what it really cost, without calling five people."

**Flow:** Order -> Shipment with Legs -> events from connectors / email / manual -> state fold -> documents in (OCR -> confirm -> cross-check vs Order) -> exception inbox -> LandedCost computed with Evidence.

**Acceptance criteria**
1. Deterministic replay; conflict rules (ADR 0003) tested incl. out-of-order and duplicate events.
2. Two real adapters + first-class manual entry; no vendor hard-coded.
3. Document field accuracy reported per document type; mismatches flagged with severity.
4. Duty/VAT rules are dated data with sources.
5. "Last updated" stamp on every status; offline-tolerant states on phone.
6. No credentials in logs (scanned in CI).

**AI vs deterministic:** state, conflicts, landed cost deterministic; OCR/extraction by model; next-action suggestions drafted by AI, approved by human.

**Human gate:** every outbound message to carriers/suppliers; mismatch acceptance.

**Error states:** connector outage; conflicting sources; document unreadable; shipment with no events for > N hours ("stale").
