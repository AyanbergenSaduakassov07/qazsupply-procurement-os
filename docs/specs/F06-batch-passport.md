# F06. Digital batch passport (future)

| Field | Value |
|---|---|
| User | Supplier, buyer, customs officer / bank (verifier) |
| Phase | 6 (M8) |
| Dependencies | C12 documents and custody events, key management ADR |
| Regulatory flag | E-signature law (ЭЦП interplay, UNVERIFIED); personal data minimisation on public page |

**Job:** "Prove origin, documents and custody of this batch to anyone in 10 seconds."
**Flow:** owner selects what to disclose -> signed, tamper-evident record -> public verification page / QR -> verifier checks signature independently of our servers.
**Acceptance:** verification works offline from our servers (published keys); revocation; only consented fields shown.
**Open term:** "batch passport".
