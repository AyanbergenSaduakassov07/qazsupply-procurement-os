# OSS verification: M2 (2026-10-09)

Checked with the GitHub API: repository exists, not archived, licence, last push, pinned SHA still resolves. Decision rule (M2 OSS task 2): keep a repo only if it beats the simplest alternative for M2's scope; every deferral names the trigger to revisit.

| Repo | Catalogue licence | GitHub licence | Archived | Last push | Pin resolves | Decision | Reason |
|---|---|---|---|---|---|---|---|
| altynbek07/python-qazaq-transliterator | MIT | MIT | false | 2021-02-25 | yes (`5a1298ed57`) | R | Re-implement: the old-to-new Kazakh alphabet mapping is a small table (services/normalize/text.py); vendoring a stale 2021 repo adds more surface than it saves. |
| moj-analytical-services/splink | MIT | MIT | false | 2026-10-06 | yes (`68ced2a461`) | deferred | Probabilistic linkage pays off at 100k+ suppliers. M2 resolves by BIN + normalised name, deterministic and explainable. Revisit with real client volumes. |
| confident-ai/deepeval | Apache-2.0 | Apache-2.0 | false | 2026-10-07 | yes (`0fb05d028b`) | deferred | Our scorers (evals/matcher, evals/findings) cover top-1/top-5/abstain/precision with zero deps. Revisit for LLM explanation judging (M3). |
| dedupeio/dedupe | MIT | MIT | false | 2025-07-29 | yes (`3f61e79102`) | deferred | Same reason as splink; also needs human active-learning sessions we cannot run on synthetic data. |
| dream-num/univer | Apache-2.0 | Apache-2.0 | false | 2026-10-09 | yes (`7efa462dbb`) | dropped (M2) | Mapping preview shows 20 rows; a native table is enough and keeps the bundle small. |
| duckdb/duckdb | MIT | MIT | false | 2026-10-09 | yes (`26e63077ac`) | deferred | Detectors run on <=50k lines in Python + Postgres within budget. Revisit if analysis exceeds 10 s. |
| FlagOpen/FlagEmbedding | MIT | MIT | false | 2026-08-24 | yes (`fd1a2bdf69`) | deferred | bge-m3 needs torch + ~2 GB weights and a model-supply-chain review. Embeddings are judged on the owner's real golden set. |
| glideapps/glide-data-grid | MIT | MIT | false | 2026-01-21 | yes (`0875d78cc4`) | dropped (M2) | No 50k-row client rendering in M2 (server paginates). |
| HypothesisWorks/hypothesis | MPL-2.0 | NOASSERTION | false | 2026-10-05 | yes (`ca2a4c6e3c`) | ADOPTED (D, dev) | Property tests for parsers and savings reconciliation. MPL-2.0, used unmodified as a test dependency. |
| J535D165/recordlinkage | BSD | BSD-3-Clause | false | 2024-02-21 | yes (`b93d976419`) | dropped | Stale; superseded by our deterministic resolver now and splink later. |
| jsvine/pdfplumber | MIT | MIT | false | 2026-08-06 | yes (`4c64b92d5c`) | deferred | No PDF ingest in M2 (M5 offers / M6 documents). |
| mholt/PapaParse | MIT | MIT | false | 2026-10-09 | yes (`4843fc2021`) | dropped (M2) | Parsing is server-side (single source of validation truth); browser parsing would duplicate it. |
| microsoft/markitdown | MIT | MIT | false | 2026-10-04 | yes (`4cc9fa1765`) | deferred | For M5/M6 document ingestion. |
| milcent/benford_py | BSD | BSD-3-Clause | false | 2022-10-11 | yes (`0126c606ae`) | deferred | Benford signals are planned as low-confidence 'integrity signals'; stale repo, simple test re-implementable. M3. |
| natasha/natasha | MIT | MIT | false | 2026-10-02 | yes (`558bf509fa`) | deferred | NER not needed for item matching on the synthetic set; evaluate on real data. |
| no-plagiarism/pymorphy3 | MIT | MIT | false | 2025-10-09 | yes (`6bb7e85a6c`) | deferred | First spike if lexical top-1 falls short (synthetic or real set). |
| open-contracting/cardinal-rs | MIT | MIT | false | 2026-10-07 | yes (`0b28400d90`) | deferred | Needs goszakup data (OWS token not yet issued). |
| pola-rs/polars | MIT | MIT | false | 2026-10-09 | yes (`4906180985`) | deferred | Same as duckdb. |
| rapidfuzz/RapidFuzz | MIT | MIT | false | 2026-09-28 | yes (`db6e504539`) | ADOPTED (D) | Lexical candidate retrieval and scoring in services/normalize; MIT. |
| react-hook-form/react-hook-form | MIT | MIT | false | 2026-10-07 | yes (`e76876b025`) | dropped (M2) | The mapping form has <10 fields; native form + server action is enough. |
| seatgeek/thefuzz | MIT | MIT | false | 2025-03-03 | yes (`1ba86f33a1`) | dropped | Thin wrapper; RapidFuzz is the faster, maintained implementation of the same algorithms. |
| SheetJS/sheetjs | Apache-2.0 | Apache-2.0 | false | 2024-04-18 | yes (`3f44ddd99c`) | dropped (M2) | Server-side parsing with openpyxl (MIT) instead; SheetJS CE is stale and npm-hosted builds lag. |
| silvermete0r/QazNLTK | MIT | MIT | false | 2026-06-21 | yes (`a2f64b87e3`) | deferred | Kazakh tokenisation spike once real kk lines exist. |
| stanfordnlp/dspy | MIT | MIT | false | 2026-10-08 | yes (`a7e7edb8c6`) | deferred | Prompt optimisation needs the real golden set and paid model calls; owner approval for spend required. |
| TanStack/virtual | MIT | MIT | false | 2026-10-09 | yes (`78371e851e`) | dropped (M2) | Review queue paginates server-side. |
| UKPLab/sentence-transformers | Apache-2.0 | Apache-2.0 | false | 2026-10-08 | yes (`68275ad5db`) | deferred | Same as FlagEmbedding. |
| unionai-oss/pandera | MIT | MIT | false | 2026-10-09 | yes (`eb7b679b0c`) | dropped (M2) | Row validation is in services/ingest with typed error codes; a dataframe layer adds no value at this size. |
| yzhao062/pyod | BSD | BSD-2-Clause | false | 2026-10-04 | yes (`3a71f47bb2`) | deferred | Outliers use a robust median/IQR rule that a reviewer can explain; PyOD for M3 integrity signals. |
| argilla-io/argilla | Apache-2.0 | Apache-2.0 | false | 2026-10-06 | yes (`5338519acc`) | deferred | The in-app review queue is the correction loop in M2; feedback rows land in match_feedback for evals. |
| HumanSignal/label-studio | Apache-2.0 | Apache-2.0 | false | 2026-10-09 | yes (`766b7ce5c6`) | deferred | Golden set is a CSV the owner can label in any spreadsheet; a sidecar is worth it when more than one labeller exists. |
| pgvector/pgvector | PostgreSQL | NOASSERTION | false | 2026-10-08 | yes (`f37c13f68b`) | deferred | No embeddings in M2 (see FlagEmbedding). |
| apertium/apertium-kaz | GPL (2 or 3, see repo) | GPL-3.0 | false | 2023-11-01 | yes (`95c6dd0d85`) | R | GPL-3.0: reference only. |
| doccano/doccano | MIT | MIT | false | 2026-04-14 | yes (`ab6b765ea3`) | R | Reference only. |
| dottxt-ai/outlines | Apache-2.0 | Apache-2.0 | false | 2026-09-21 | yes (`c52af8472c`) | R | We enforce 'choose only among retrieved codes' by validating the model's answer against the candidate list. |
| great-expectations/great_expectations | Apache-2.0 | Apache-2.0 | false | 2026-10-08 | yes (`9ba940cb7c`) | R | Data-quality patterns informed the ingest error codes. |
| zinggAI/zingg | AGPL-3.0 | AGPL-3.0 | false | 2026-09-13 | yes (`9e3595a9ca`) | R | AGPL-3.0: reference only. |

Not in the catalogue, added after licence check: `openpyxl` 3.1.5 (MIT, server-side .xlsx parsing), `python-multipart` 0.0.32 (Apache-2.0, FastAPI uploads).

GitHub reports `NOASSERTION` for hypothesis (MPL-2.0 per its LICENSE) and pgvector (PostgreSQL licence); both match the catalogue.
