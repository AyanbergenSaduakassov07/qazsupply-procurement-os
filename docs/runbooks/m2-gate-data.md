# M2 gate: what the owner provides, and how it is run

The M2 gate (`docs/prompts/PROGRESS.md`) is **matcher >= 90% top-1 at <= 15% abstain** on 300 owner-labelled lines, and **finding precision >= 80%** on two hand-audited datasets. Everything else in M2 is built. This page lists the inputs that only the owner can produce, in the exact format the runner expects, so the gate can be run the day they arrive.

Nothing here is real data. Real files never go into the repo: keep them outside it (for example `~/qazsupply-gate/`) and pass the path.

## 1. ЕНС ТРУ access (blocks 2 and the real classifier)

Two routes, both owner actions (external messages; the agent drafts, the owner sends):

| Route | To | Ask for | Status |
|---|---|---|---|
| A | АО «Центр электронных финансов» (goszakup OWS v3) | An OWS v3 token, and written confirmation that using public lot data (`Lots.enstruList`, `nameRu`, `nameKz`) for commercial spend analytics is permitted | Token on request by template letter (operator's developer page, `docs/compliance/data-sources.md`). Contact address UNVERIFIED |
| B | ТОО «Самрук-Казына Контракт» (ЕНС ТРУ operator) | Bulk export of the classifier (codes, ru/kk names, units, hierarchy) and its terms of use | No public bulk download found (2026-10-09) |

Draft purpose paragraph for route A (Russian; adapt to the operator's template letter, which takes precedence):

> Просим предоставить токен доступа к открытым сервисам OWS v3 портала государственных закупок для организации «…» (БИН …). Цель использования: аналитика расходов на закупки для клиентов (сопоставление позиций с кодами ЕНС ТРУ по открытым данным лотов). Просим также письменно подтвердить, допускается ли использование открытых данных OWS v3 в коммерческом аналитическом сервисе, и указать применимые условия.

Record the answer (date, who, terms) in `docs/compliance/data-sources.md` before the connector is switched from the synthetic sample.

## 2. Matcher golden set: 300 hand-labelled lines

One UTF-8 CSV, header exactly `id,text,label,lang`:

| Column | Rule |
|---|---|
| `id` | Unique, any string (`O001`...) |
| `text` | The item text exactly as it appears in a real purchase export. Do not clean it up |
| `label` | The correct ЕНС ТРУ code; `NONE` if no code fits; `BUNDLED` if the line holds several items |
| `lang` | `ru`, `kk`, `latin` or `mixed` (the tags the scorer reports top-1 by) |

Composition: lines from at least 3 different real exports, with Kazakh and mixed lines included (the M2 prompt asks for ru, kk and mixed). Label without looking at the matcher's suggestions, so the set measures the matcher instead of agreeing with it.

How it is run (agent): load the real classifier, hold out a test split, refit calibration on the rest (D18), then score with the existing definitions in `evals/matcher/score.py` (top-1, top-5, abstain, auto-precision, cost per 1k lines). A gate runner that reads an external path is a scorer change, so it lands as a separate `harness-change` PR before it is used, and is reviewed before it scores anything.

## 3. Two hand-audited spend datasets

For each dataset:
1. A real spend export (csv/xlsx, as a client would upload it), at least a few hundred lines.
2. Upload it on a local or staging stack and run the analysis as a reviewer.
3. The owner (or an auditor they name) marks each finding `correct` or `wrong`, with a one-line reason for each `wrong`.

Precision = correct findings / all findings, per dataset and overall; the gate needs >= 80%. The auditor's sheet is the evidence: record its location, the date and who scored it in `PROGRESS.md`. The agent never scores this itself (M2 prompt: "scored by me").

## 4. After the inputs arrive

1. Agent switches `connectors/enstru` to the licensed source (contract tests, fixtures, register row), keeping the `SYN-*` sample for tests.
2. Agent runs 2 and 3, pastes the real output into `PROGRESS.md` "Gate result / evidence", and closes D17 / D18 in `docs/tech-debt.md` if they pass.
3. If a threshold fails, the status stays `blocked` with the numbers; thresholds are never lowered.
