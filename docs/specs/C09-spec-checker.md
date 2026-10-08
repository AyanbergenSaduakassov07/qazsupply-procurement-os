# C09. Technical specification (ТЗ) checker

| Field | Value |
|---|---|
| User | Procurement manager, technical specialist |
| Phase | 3 (M5) |
| Dependencies | Catalogue (C11), standards references (ГОСТ/ST RK; licence UNVERIFIED), LLM gateway |
| Regulatory flag | Public-procurement rules on brand-locking apply to quasi-state buyers (UNVERIFIED per client type) |

**Job:** "Catch problems in my ТЗ before suppliers do: vague terms, brand-locking, missing parameters."

**Flow:** paste/upload ТЗ -> requirement extraction -> flags: ambiguity, brand-locking, missing parameters, conflicting standards -> suggested equivalents with sources -> reviewer-visible diff -> export.

**Acceptance criteria**
1. Extraction F1 reported on a golden set of ТЗ documents.
2. Each flag cites the exact text span and the rule that triggered it.
3. Equivalent suggestions show "what differs" and a source.
4. Acceptance rate of equivalents measured.

**AI vs deterministic:** extraction and phrasing by LLM; rules (brand names list, required-parameter templates per category) deterministic.

**Human gate:** user decides every change; nothing auto-edits the ТЗ.

**Error states:** scanned PDF with bad OCR; unknown category (no template).
