# Brand voice and microcopy rules

Voice: **calm, precise, evidence-first.** We sound like a careful auditor who is on the client's side. We never sell inside the product.

## Principles
1. **Lead with the fact, then the source.** "Цена выше рынка на 18% · 12 строк, март–июнь" not "Мы нашли отличную возможность!"
2. **Numbers carry units, period and source.** Every figure is clickable to Evidence.
3. **Say what we don't know.** "Недостаточно данных для прогноза" is a valid, designed message.
4. **No hype, no slang, no exclamation marks**, no "AI magic", no "революционный", no emoji in product UI.
5. **AI-generated text is labelled** ("Черновик ИИ, проверьте" / "ЖИ жобасы, тексеріңіз" / "AI draft, please check").
6. **Errors say cause + fix.** "Строка 214: не указана дата. Исправьте файл или пропустите строку."
7. **Never blame the user**; never threaten ("Ваш аккаунт будет заблокирован").
8. **Legal restraint:** "may", "estimated", "potential saving" for savings; never "guaranteed". Sanctions: "possible match, needs review", never "sanctioned company" until a human confirms.

## Russian
- Formal **«Вы»** in all product text. Capitalised «Вы» only in direct personal letters/emails, lowercase «вы» in UI strings (UNVERIFIED house rule: owner to confirm).
- Neutral business register; avoid bureaucratese chains («в целях осуществления»). Prefer verbs: «Загрузите файл», not «Осуществите загрузку файла».
- Numbers: space as thousands separator, comma decimal: 1 250 000,50 ₸. Dates: 08.10.2026 in tables, «8 октября 2026» in prose.
- Buttons: infinitive or imperative, consistent per product (pick imperative: «Загрузить» vs «Загрузите». Decision: **infinitive on buttons, imperative in instructions**).

## Kazakh
- Formal **«Сіз»** throughout; never «сен».
- Use current Cyrillic orthography with ә ғ қ ң ө ұ ү һ і; never substitute Russian look-alikes (е for ә, к for қ). CI check in `packages/i18n` (M1): flag kk strings containing no Kazakh-specific letters where expected, and Latin/Cyrillic homoglyph mixing.
- Latin-script transition: Kazakhstan's planned move to Latin script is not in force for UI yet (UNVERIFIED); keep Cyrillic, design for text expansion.
- Every kk string is reviewed by a native speaker before release (M0 strings are UNVERIFIED).
- Terminology: keep official terms used by goszakup.gov.kz kk interface where they exist (to collect in a glossary in M1).

## English
Plain international English, sentence case, no idioms ("ballpark", "low-hanging fruit").

## Word list (preferred / avoid)
| Use | Avoid |
|---|---|
| Finding: **Замечание** (ru), **Ескерту** (kk, UNVERIFIED) | «Находка», «Инсайт» |
| Potential saving / Потенциальная экономия | Guaranteed savings / Гарантированная экономия |
| Possible match / Возможное совпадение | Sanctioned / Санкционный (before review) |
| Evidence / Основание / Негіздеме (UNVERIFIED) | Proof / Доказательство (legal weight) |
| Review / Проверка | Approval by AI |
