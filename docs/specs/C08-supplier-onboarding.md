# C08. Supplier onboarding

| Field | Value |
|---|---|
| User | Supplier sales rep (fills); procurement manager (invites, approves) |
| Phase | 2 (M4); reused by the supplier portal (M8) |
| Dependencies | C06, C07, document OCR, notifications |
| Regulatory flag | Supplier PII (contacts, directors); consent text |

**Job (supplier):** "Get approved as a vendor from my phone in one sitting." **Job (buyer):** "Know a new vendor is checked before the first order."

**Flow:** buyer invites by email -> supplier opens link (no account wall) -> checklist (company data prefilled from registry by BIN, bank details, certificates, contacts) -> upload docs -> OCR extracts fields -> supplier confirms extracted fields -> screening runs -> buyer reviews -> approved / needs info.

**Acceptance criteria**
1. Works on a phone viewport; progress saved; never more than one screen of fields at a time.
2. Extracted fields are confirmed by the supplier before use.
3. Supplier documents are untrusted input (injection tests on PDFs).
4. Buyer approval is explicit and logged.

**AI vs deterministic:** OCR/extraction by model via gateway; validation deterministic (BIN checksum, IBAN format).

**Human gate:** buyer approves.

**Error states:** invite expired; BIN mismatch with registry; document unreadable; screening hit (onboarding paused, buyer notified).
