# C01. Spend upload and ingest

| Field | Value |
|---|---|
| User | Procurement manager (uploads); QazSupply reviewer (assists on first audits) |
| Phase | 1 (M2) |
| Dependencies | Tenancy (M1), Evidence model (M1), files storage |
| Regulatory flag | Client-confidential data; contract/NDA with client before upload; no PII expected but buyer names may appear |

**Job:** "Get my messy 1C/SAP/Excel purchase export into the system without cleaning it myself."

**Flow:** drag-drop xlsx/csv -> hash check (already uploaded? show link) -> sheet pick -> auto-suggested column mapping with live preview of 20 rows -> validation (encoding, dates, numbers, currencies, units, duplicates) -> row-level error report -> confirm -> `PurchaseLinesIngested`.

**Acceptance criteria**
1. Re-uploading the same file in the same org creates no new lines and links to the earlier Upload.
2. Every Purchase Line stores Upload id + sheet + row number; original cell values preserved.
3. Invalid rows never block valid rows; each rejected row has a plain-language reason in the user's language ("Row 214: the date is missing").
4. 50k rows ingest in < 60 s on reference hardware.
5. Mapping suggestions are deterministic (header dictionary ru/kk/en + value sniffing); user can override and save a mapping template per org.
6. Cell text never reaches an LLM unscrubbed or with tool access.

**Data needed:** client export; header synonym dictionary (ru/kk/en); currency and unit dictionaries.

**AI vs deterministic:** parsing, mapping suggestions, validation: deterministic. AI: none in M2 (optional later: header-mapping suggestion for unknown headers, via gateway, as suggestion only).

**Human gate:** user confirms mapping before ingest.

**Error states:** wrong file type; password-protected; > size limit; no header row; mixed currencies without currency column; macro-enabled file (rejected).
