# C11. Catalogue, analogs and price history

| Field | Value |
|---|---|
| User | Procurement manager, technical specialist |
| Phase | 3 (M5) |
| Dependencies | C02 (Items), C03 (price history), consent model |
| Regulatory flag | Sharing price data across tenants: consent + k-anonymity; competition-law check (UNVERIFIED) |

**Job:** "Find an acceptable analog and know what a fair price is."

**Flow:** search (forgiving ru/kk spelling) -> Item page: attributes, units, standards, ЕНС ТРУ link, own price history (source/date), shared price band (only if consented, k >= threshold) -> analogs with "why acceptable / what differs" -> accept/reject feedback.

**Acceptance criteria**
1. Private vs shared boundary explicit in UI and data model.
2. Shared aggregates suppressed below k (default 5) and never reveal a single tenant's volume.
3. Analog acceptance rate measured with reviewers.
4. Filters explain empty results.

**AI vs deterministic:** attribute-aware + embedding retrieval; LLM only explains differences. Price bands deterministic.

**Human gate:** consent to share (org admin).

**Error states:** no price history; below-k aggregate ("not enough data to show a market range").
