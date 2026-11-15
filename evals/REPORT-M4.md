# M4 eval report: sanctions/PEP name screening (2026-10-12)

**Set:** `evals/screening/cases.py`, INVENTED names only: 20 listed entities (15 persons, 5 companies), 54 positive queries in 29 variant kinds (script swap, Kazakh letters, Kazakh Latin, Uzbek Latin, patronymic forms, word order, legal forms with quotes, one typo, missing middle name, English names written in Cyrillic), 25 negatives (shared surname or root, shared first name, shared business words, unrelated).

**Matcher:** `services/supplier360/match.py` (Latin skeleton + one-to-one RapidFuzz token alignment). Gate: `evals/screening/test_gate.py` requires recall 1.0.

Measured on the final set (54 positives, 25 negatives).

| Threshold | Recall | False positives per query | Negatives with any hit |
|---|---|---|---|
| 70 | 1.00 | 0.165 | 0.36 |
| 75 | 1.00 | 0.063 | 0.12 |
| 78 | 1.00 | 0.013 | 0.04 |
| **80 (chosen)** | **1.00** | **0.000** | **0.00** |
| 82 | 1.00 | 0.000 | 0.00 |
| 85 | 0.96 | 0.000 | 0.00 |

Before the English-spelling folds (c/k, gh, th) two English names written in Cyrillic were missed at every threshold >= 80; the fold fixed them.

**Added after code review (2026-10-12):** Russian and Kazakh legal forms (ОАО, АҚ, ЖАҚ, ГУП, ...) survived as name tokens and capped one-word company names at 60 (verified miss: «ОАО Рособоронэкспорт» vs the bare name). Three legal-form cases were added; recall stays 1.00 at 80 on 54 positives.

**Honest limits.** Translated names (Northern Lights vs «Северное сияние») are not matched: only spelling variants are. The set and the threshold come from the same hands and the same day (selection bias). Real lists carry aliases, transliteration tables and dates of birth that this set only imitates. On the demo data the 45 invented minority shareholders of "ТОО «Гамма Индастри»" produce namesake hits (e.g. a generated "Мұқанов Данияр" vs a sample PEP), which is the expected review load. The M4 acceptance item "sanctions recall reported on the labelled set" is met for this synthetic set only; recall on real data is NOT measured.
