# C02. Item normalization to ЕНС ТРУ

| Field | Value |
|---|---|
| User | Reviewer (works the low-confidence queue); procurement manager (sees result) |
| Phase | 1 (M2) |
| Dependencies | C01; ЕНС ТРУ data access (UNVERIFIED, see data-sources); LLM gateway; pgvector |
| Regulatory flag | ЕНС ТРУ licence/terms unknown |

**Job:** "Know that 'Перчатки нитрил. L уп.100' and 'Қолғап нитрилді L' are the same Item so prices can be compared."

**Flow:** line text -> deterministic cleanup (units, abbreviations, transliteration) -> lexical + embedding retrieval of top-k ЕНС ТРУ candidates -> LLM rerank restricted to candidates -> calibrated confidence -> above threshold: auto-match; below: review queue (keyboard-first accept / reject / edit, shows why).

**Acceptance criteria**
1. Golden set of 300 hand-labelled lines (ru, kk, mixed) exists before tuning.
2. Top-1 >= 90% at <= 15% abstain; top-5 reported; cost per 1k lines reported.
3. LLM output that names a code outside the candidate list is rejected.
4. Confidence is calibrated (reliability plot in eval report).
5. Bundled lines are flagged, not force-matched (Q5 default).
6. Human corrections feed the golden set (with review).

**Data needed:** ЕНС ТРУ codes + names (ru, kk) + hierarchy; labelled lines; synonym lists.

**AI vs deterministic:** retrieval + thresholds deterministic; rerank by LLM; embeddings by model (model-supply-chain review). Unit/currency normalization deterministic (dated FX from `fx` connector).

**Human gate:** low-confidence matches; any match used in a released Report finding is reviewer-visible.

**Error states:** classifier unavailable (queue all); line text empty; ambiguous code family (show top 3).
