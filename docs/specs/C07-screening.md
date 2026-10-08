# C07. Screening: sanctions, PEP, dual-use, beneficial owners

| Field | Value |
|---|---|
| User | Compliance-minded procurement manager; QazSupply reviewer |
| Phase | 2 (M4) |
| Dependencies | OpenSanctions licence (paid; see data-sources); registries; HS/ЕНС ТРУ for goods; party graph |
| Regulatory flag | HIGH: sanctions false negatives; KZ personal data law; EU/US secondary-sanctions exposure for clients |

**Job:** "Tell me before I sign if this supplier, its owners, or the goods are sanctioned or dual-use."

**Flow:** Party (and owners) + Items -> name matching across kk/ru/en/Latin transliterations -> candidate hits with explainable scores -> human confirms or dismisses with reason code -> result stored with source version -> re-screen on schedule and at every RFQ decision, Order and Shipment.

**Acceptance criteria**
1. Labelled test set incl. transliteration variants; zero known false negatives; recall and reviewer FP load reported.
2. A hit never auto-blocks; reason code mandatory on confirm/dismiss.
3. Every check logs source, source version, timestamp, reviewer.
4. Dual-use screening of goods by HS code against the configured control lists (lists UNVERIFIED; counsel to pick).

**AI vs deterministic:** matching deterministic (phonetic + transliteration + fuzzy scores). LLM may explain a match, never decide.

**Human gate:** every hit.

**Error states:** source unavailable (screening "incomplete", visibly; never "clear"); owner data unknown ("ownership not verified").
