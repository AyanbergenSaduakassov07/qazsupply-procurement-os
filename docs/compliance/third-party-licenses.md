# Third-party licences: policy and register

Status: generated 2026-10-08. Not legal advice; a lawyer must review before launch (especially anything marked gate).

## Policy

1. **Allowed to ship in the product (D, V, S):** MIT, Apache-2.0, BSD-2/3, ISC, PostgreSQL licence. MPL-2.0 is allowed unmodified (as a dependency or CLI) and any modified MPL file must stay MPL.
2. **LGPL:** install unmodified from a registry or run as a separate service. Never vendor, never modify.
3. **Reference only (R):** GPL, AGPL, BUSL, EPL, mixed/source-available, and any repo with no licence. We read and learn; we copy no code. No GPL/AGPL/BUSL code in any build artifact.
4. **No licence file means all rights reserved.** A licence stated only in registry metadata (PyPI/npm) is installable as a dependency; before vendoring, get a LICENSE file in the upstream repo or written permission from the author.
5. **Vendoring rules:** copy only the needed paths at a pinned commit into `vendor/<slug>/`; keep LICENSE/NOTICE and file headers; add `UPSTREAM.md` (repo, SHA, licence, date, local changes); do not edit vendored files, put adaptations in the owning module; record the entry in `vendor/vendor.lock.json`.
6. **Data licences are separate from code licences.** OpenSanctions data, UN/LOCODE, ports and HS datasets, weather and news content each need their own check in `docs/compliance/data-sources.md`.
7. **Models and weights** (embeddings, forecasters, OCR) have their own licences. Run `model-supply-chain` review before adding any.
8. **CI gate:** licence scan (ScanCode), SBOM (CycloneDX or Syft), vulnerability scan (OSV-Scanner, Trivy), secret scan (gitleaks). The build fails on a non-allowed licence.
9. **Re-verify** each repo at the start of its phase: exists, not archived, licence unchanged, SHA still current.
10. **Attribution:** `THIRD_PARTY_NOTICES.md` is generated from this register and shipped with the product.

## Register

| Repo | Licence | Class | Mode | Pin | Prompt | Gate / note |
|---|---|---|---|---|---|---|
| aboutcode-org/scancode-toolkit | Apache-2.0 (auto-detect failed; confirm) | PERMISSIVE | D | `5e8448ecf2` | M0 |  |
| anchore/syft | Apache-2.0 | PERMISSIVE | D | `546c872c9d` | M0 |  |
| anthropics/skills | Mixed: Apache-2.0 skills + source-available doc skills | STRONG | R | `683bc88e56` | M0 | copy nothing from docx/pdf/pptx/xlsx skills (source-available); Apache skills only as patterns |
| aquasecurity/trivy | Apache-2.0 | PERMISSIVE | D | `3f664e55b7` | M0 |  |
| astral-sh/ruff | MIT | PERMISSIVE | D | `4830211afd` | M0 |  |
| astral-sh/uv | MIT | PERMISSIVE | D | `301799d971` | M0 |  |
| biomejs/biome | MIT | PERMISSIVE | D | `c870caa641` | M0 |  |
| CycloneDX/cyclonedx-python | Apache-2.0 | PERMISSIVE | D | `fc119872ab` | M0 |  |
| github/github-mcp-server | MIT | PERMISSIVE | S | `55edd58d5e` | M0 |  |
| gitleaks/gitleaks | MIT | PERMISSIVE | D | `b58d3f102c` | M0 |  |
| google/osv-scanner | Apache-2.0 | PERMISSIVE | D | `afb21ed4eb` | M0 |  |
| mattpocock/skills | MIT | PERMISSIVE | R | `f3fc5632f4` | M0 |  |
| microsoft/playwright | Apache-2.0 | PERMISSIVE | D | `4357c237cf` | M0 |  |
| microsoft/playwright-mcp | Apache-2.0 | PERMISSIVE | S | `a6d7678b7b` | M0 |  |
| modelcontextprotocol/servers | Apache-2.0 | PERMISSIVE | R | `5abed86c53` | M0 |  |
| obra/superpowers | MIT | PERMISSIVE | R | `8ca22dba9a` | M0 |  |
| open-contracting/standard | Apache-2.0 | PERMISSIVE | R | `8357b17f6d` | M0 |  |
| pnpm/pnpm | MIT | PERMISSIVE | D | `45e79172d8` | M0 |  |
| pre-commit/pre-commit | MIT | PERMISSIVE | D | `c4292384c9` | M0 |  |
| PyCQA/bandit | Apache-2.0 | PERMISSIVE | D | `68ebe11ef7` | M0 |  |
| pytest-dev/pytest | MIT | PERMISSIVE | D | `59200df778` | M0 |  |
| upstash/context7 | MIT | PERMISSIVE | S | `ba9d74c4da` | M0 |  |
| vercel/turborepo | MIT | PERMISSIVE | D | `7b470b6b86` | M0 |  |
| 21st-dev/magic-mcp | ISC | PERMISSIVE | S | `6b5299e8a8` | M1 |  |
| 567-labs/instructor | MIT | PERMISSIVE | D | `e12f8b4920` | M1 |  |
| amannn/next-intl | MIT | PERMISSIVE | D | `b9fc98a814` | M1 |  |
| anthropics/anthropic-sdk-python | MIT | PERMISSIVE | D | `50b78d17a8` | M1 |  |
| BerriAI/litellm | MIT | PERMISSIVE | D | `7c7efd4d55` | M1 |  |
| colinhacks/zod | MIT | PERMISSIVE | D | `0b216ef674` | M1 |  |
| dequelabs/axe-core | MPL-2.0 | PERMISSIVE | D | `cfd2ea6004` | M1 | MPL-2.0: use unmodified as dependency |
| emilkowalski/sonner | MIT | PERMISSIVE | D | `8e4662b392` | M1 |  |
| emilkowalski/vaul | MIT | PERMISSIVE | D | `3e97aac6a3` | M1 |  |
| fastapi/fastapi | MIT | PERMISSIVE | D | `9269f17524` | M1 |  |
| ibelick/motion-primitives | NOT FOUND | UNKNOWN | R | `120f64f6ca` | M1 | was V; no clear licence: reference only until the author clarifies |
| juliangarnier/anime | MIT | PERMISSIVE | D | `01b81be1df` | M1 |  |
| langfuse/langfuse | MIT | PERMISSIVE | S | `3d680c019d` | M1 |  |
| lost-pixel/lost-pixel | MIT | PERMISSIVE | D | `f08221fc2a` | M1 |  |
| magicuidesign/magicui | MIT | PERMISSIVE | V | `cdb348cb4c` | M1 |  |
| microsoft/presidio | MIT | PERMISSIVE | D | `2523c7b74a` | M1 |  |
| motiondivision/motion | MIT | PERMISSIVE | R | `55eb6bbd5f` | M1 |  |
| mswjs/msw | MIT | PERMISSIVE | D | `501a591640` | M1 |  |
| open-telemetry/opentelemetry-python | Apache-2.0 | PERMISSIVE | D | `319d84a7f1` | M1 |  |
| pacocoursey/cmdk | MIT | PERMISSIVE | D | `dd2250ed60` | M1 |  |
| procrastinate-org/procrastinate | MIT | PERMISSIVE | D | `1548b3ef26` | M1 |  |
| python-babel/babel | BSD | PERMISSIVE | D | `e2a17919f0` | M1 |  |
| radix-ui/primitives | MIT | PERMISSIVE | D | `4e8b0dbc76` | M1 |  |
| rdev/liquid-glass-react | MIT | PERMISSIVE | D | `ac48eab18d` | M1 |  |
| recharts/recharts | MIT | PERMISSIVE | D | `189c0d71c3` | M1 |  |
| schemathesis/schemathesis | MIT | PERMISSIVE | D | `7efc851bbd` | M1 |  |
| shadcn-ui/ui | MIT | PERMISSIVE | V | `97ddbf4274` | M1 |  |
| sqlalchemy/alembic | MIT | PERMISSIVE | D | `1bc21b86dd` | M1 |  |
| storybookjs/storybook | MIT | PERMISSIVE | D | `33217def5a` | M1 |  |
| supabase/supabase | Apache-2.0 | PERMISSIVE | S | `af3e397e7f` | M1 |  |
| supabase/supabase-py | MIT | PERMISSIVE | D | `dfae141929` | M1 |  |
| TanStack/query | MIT | PERMISSIVE | D | `01a7ebdd02` | M1 |  |
| TanStack/table | MIT | PERMISSIVE | D | `6aa0d74946` | M1 |  |
| tembo-io/pgmq | PostgreSQL | PERMISSIVE | R | `8cc0959b24` | M1 |  |
| testcontainers/testcontainers-python | Apache-2.0 | PERMISSIVE | D | `6146aa1170` | M1 |  |
| theory/pgtap | PostgreSQL (per README) | PERMISSIVE | D | `21ceed193b` | M1 |  |
| timgit/pg-boss | MIT | PERMISSIVE | D | `05dc216001` | M1 |  |
| altynbek07/python-qazaq-transliterator | MIT | PERMISSIVE | V | `5a1298ed57` | M2 |  |
| apertium/apertium-kaz | GPL (2 or 3, see repo) | STRONG | R | `95c6dd0d85` | M2 |  |
| argilla-io/argilla | Apache-2.0 | PERMISSIVE | S | `5338519acc` | M2 |  |
| confident-ai/deepeval | Apache-2.0 | PERMISSIVE | D | `0fb05d028b` | M2 |  |
| dedupeio/dedupe | MIT | PERMISSIVE | D | `3f61e79102` | M2 |  |
| doccano/doccano | MIT | PERMISSIVE | R | `ab6b765ea3` | M2 |  |
| dottxt-ai/outlines | Apache-2.0 | PERMISSIVE | R | `c52af8472c` | M2 |  |
| dream-num/univer | Apache-2.0 | PERMISSIVE | D | `7efa462dbb` | M2 |  |
| duckdb/duckdb | MIT | PERMISSIVE | D | `26e63077ac` | M2 |  |
| FlagOpen/FlagEmbedding | MIT | PERMISSIVE | D | `fd1a2bdf69` | M2 |  |
| glideapps/glide-data-grid | MIT | PERMISSIVE | D | `0875d78cc4` | M2 |  |
| great-expectations/great_expectations | Apache-2.0 | PERMISSIVE | R | `9ba940cb7c` | M2 |  |
| HumanSignal/label-studio | Apache-2.0 | PERMISSIVE | S | `766b7ce5c6` | M2 |  |
| HypothesisWorks/hypothesis | MPL-2.0 | PERMISSIVE | D | `ca2a4c6e3c` | M2 | MPL-2.0: use unmodified as dependency |
| J535D165/recordlinkage | BSD | PERMISSIVE | D | `b93d976419` | M2 |  |
| jsvine/pdfplumber | MIT | PERMISSIVE | D | `4c64b92d5c` | M2 |  |
| mholt/PapaParse | MIT | PERMISSIVE | D | `4843fc2021` | M2 |  |
| microsoft/markitdown | MIT | PERMISSIVE | D | `4cc9fa1765` | M2 |  |
| milcent/benford_py | BSD | PERMISSIVE | D | `0126c606ae` | M2 |  |
| moj-analytical-services/splink | MIT | PERMISSIVE | V | `68ced2a461` | M2 |  |
| natasha/natasha | MIT | PERMISSIVE | D | `558bf509fa` | M2 |  |
| no-plagiarism/pymorphy3 | MIT | PERMISSIVE | D | `6bb7e85a6c` | M2 |  |
| open-contracting/cardinal-rs | MIT | PERMISSIVE | D | `0b28400d90` | M2 |  |
| pgvector/pgvector | PostgreSQL | PERMISSIVE | S | `f37c13f68b` | M2 |  |
| pola-rs/polars | MIT | PERMISSIVE | D | `4906180985` | M2 |  |
| rapidfuzz/RapidFuzz | MIT | PERMISSIVE | D | `db6e504539` | M2 |  |
| react-hook-form/react-hook-form | MIT | PERMISSIVE | D | `e76876b025` | M2 |  |
| seatgeek/thefuzz | MIT | PERMISSIVE | D | `1ba86f33a1` | M2 |  |
| SheetJS/sheetjs | Apache-2.0 | PERMISSIVE | D | `3f44ddd99c` | M2 |  |
| silvermete0r/QazNLTK | MIT | PERMISSIVE | D | `a2f64b87e3` | M2 |  |
| stanfordnlp/dspy | MIT | PERMISSIVE | D | `a7e7edb8c6` | M2 |  |
| TanStack/virtual | MIT | PERMISSIVE | D | `78371e851e` | M2 |  |
| UKPLab/sentence-transformers | Apache-2.0 | PERMISSIVE | D | `68275ad5db` | M2 |  |
| unionai-oss/pandera | MIT | PERMISSIVE | D | `eb7b679b0c` | M2 |  |
| yzhao062/pyod | BSD | PERMISSIVE | D | `3a71f47bb2` | M2 |  |
| zinggAI/zingg | AGPL-3.0 | STRONG | R | `9e3595a9ca` | M2 |  |
| airbnb/visx | MIT | PERMISSIVE | D | `485c035966` | M3 |  |
| anthropics/claude-agent-sdk-python | MIT | PERMISSIVE | D | `f7b0b62c2a` | M3 |  |
| anthropics/claude-cookbooks | MIT | PERMISSIVE | R | `d7265d6ae9` | M3 |  |
| apache/echarts | Apache-2.0 | PERMISSIVE | D | `34f4d927ea` | M3 |  |
| assistant-ui/assistant-ui | MIT | PERMISSIVE | D | `6ca5ca4080` | M3 |  |
| diegomura/react-pdf | MIT | PERMISSIVE | D | `e7b14db1e5` | M3 | ADOPTED 2026-10-12: `@react-pdf/renderer@4.9.0` (npm, MIT), report PDF export (`apps/web/components/report/report-pdf.tsx`); proven by the e2e PDF = screen check |
| exceljs/exceljs | MIT | PERMISSIVE | D | `5bed18b45e` | M3 |  |
| explodinggradients/ragas | Apache-2.0 | PERMISSIVE | D | `298b682742` | M3 |  |
| guardrails-ai/guardrails | Apache-2.0 | PERMISSIVE | R | `06d0ff2c5f` | M3 |  |
| jlowin/fastmcp | Apache-2.0 | PERMISSIVE | D | `5baeacfe20` | M3 |  |
| modelcontextprotocol/python-sdk | MIT | PERMISSIVE | D | `9972c21aa4` (v2.2.0, PyPI `mcp==2.2.0`) | M3 | **adopted 2026-10-13** (D24): read-only MCP server at `/mcp/`; pulls `httpx2` (BSD-3-Clause), `mcp-types`, `sse-starlette` (BSD-3-Clause); licence gate green |
| NVIDIA/garak | Apache-2.0 | PERMISSIVE | D | `aa5262f13d` | M3 |  |
| NVIDIA/NeMo-Guardrails | Apache-2.0 | PERMISSIVE | R | `9f793de53e` | M3 |  |
| promptfoo/promptfoo | MIT | PERMISSIVE | D | `bbb583afc8` | M3 |  |
| protectai/llm-guard | MIT | PERMISSIVE | D | `168c1034ff` | M3 |  |
| pydantic/pydantic-ai | MIT | PERMISSIVE | D | `f55bb8a6fd` | M3 |  |
| sigex-kz/ncalayer-js-client | MIT | PERMISSIVE | D | `85faf4d5df` | M3 |  |
| vercel/ai | Apache-2.0 | PERMISSIVE | D | `5028fa46b4` | M3 |  |
| alephdata/aleph | MIT | PERMISSIVE | R | `fafcc8dfa4` | M4 |  |
| alephdata/followthemoney | MIT | PERMISSIVE | D | `c70a89ffa5` | M4 |  |
| arthurdejong/python-stdnum | LGPL (see repo) | WEAK | D | `006192e59b` | M4 | LGPL: keep unmodified, dynamic install only |
| citusdata/pg_cron | PostgreSQL-style permissive | PERMISSIVE | S | `5cedfa472c` | M4 |  |
| cytoscape/cytoscape.js | MIT | PERMISSIVE | D | `7ba634095d` | M4 |  |
| elessarelfstone/kgd | MIT per PyPI (no LICENSE file in repo) | UNCONFIRMED | D* | `1ba333148d` | M4 | licence only declared on PyPI/registry: install from registry now; vendor only after LICENSE confirmed |
| elessarelfstone/tcomapi | MIT per PyPI (no LICENSE file in repo) | UNCONFIRMED | D* | `1ba333148d` | M4 | licence only declared on PyPI/registry: install from registry now; vendor only after LICENSE confirmed |
| jacomyal/sigma.js | MIT | PERMISSIVE | D | `d32c4e5bfd` | M4 |  |
| jamesturk/jellyfish | MIT | PERMISSIVE | D | `b21046a4f0` | M4 |  |
| kevin1024/vcrpy | MIT | PERMISSIVE | D | `c599974b31` | M4 |  |
| open-contracting/kingfisher-collect | BSD | PERMISSIVE | R | `e17c985dbd` | M4 |  |
| open-contracting/ocdskit | BSD | PERMISSIVE | D | `eaa1a4466b` | M4 |  |
| openaleph/openaleph | MIT | PERMISSIVE | R | `93f25d8b20` | M4 |  |
| openownership/data-standard | Apache-2.0 | PERMISSIVE | V | `e8cc3fd7a7` | M4 |  |
| opensanctions/nomenklatura | MIT | PERMISSIVE | D | `c9224abbf4` | M4 |  |
| opensanctions/opensanctions | MIT | PERMISSIVE | R | `ce59ef947b` | M4 |  |
| opensanctions/rigour | MIT | PERMISSIVE | D | `3cf1403590` | M4 |  |
| opensanctions/yente | MIT | PERMISSIVE | S | `28af9231b1` | M4 |  |
| xyflow/xyflow | MIT | PERMISSIVE | D | `3d35b57317` | M4 |  |
| apache/ofbiz-framework | Apache-2.0 | PERMISSIVE | R | `f4a6d19a0f` | M5 |  |
| frappe/erpnext | GPL-3.0 | STRONG | R | `0c2c35655a` | M5 |  |
| inventree/InvenTree | MIT | PERMISSIVE | R | `800cbe0d30` | M5 |  |
| meilisearch/meilisearch | MIT + BUSL-1.1 (EE parts) | STRONG | S | `e958ee3edd` | M5 | use MIT core only, never enable EE features |
| odoo/odoo | LGPL (see repo) | WEAK | R | `3e1d217304` | M5 |  |
| typesense/typesense | GPL (2 or 3, see repo) | STRONG | R | `86a3337b65` | M5 |  |
| camelot-dev/camelot | MIT | PERMISSIVE | D | `b300e9e31a` | M6 |  |
| datalab-to/marker | Apache-2.0 | PERMISSIVE | D* | `e7c67f1d23` | M6 | code is Apache-2.0; model weights use a modified OpenRAIL-M (free for research, personal and startups under 5M USD funding/revenue; paid beyond): read the weights terms, then benchmark in M6 |
| datasets/un-locode | NOT FOUND in repo | UNKNOWN | R | `b1309b37ed` | M6 | was V; no clear licence: reference only until the author clarifies |
| docling-project/docling | MIT | PERMISSIVE | D | `9590eb4955` | M6 |  |
| getomni-ai/zerox | MIT | PERMISSIVE | V | `91bbb20c50` | M6 |  |
| invoice-x/invoice2data | MIT | PERMISSIVE | V | `09378126e3` | M6 |  |
| jkeen/tracking_number | MIT | PERMISSIVE | R | `4e30609478` | M6 |  |
| karrioapi/karrio | LGPL (see repo) | WEAK | S | `deea10f856` | M6 | LGPL-3.0 core run as a separate service; the ee/ directory has a separate commercial licence: never use ee/ |
| kreuzberg-dev/kreuzberg | MIT | PERMISSIVE | D | `4a5d57f225` | M6 |  |
| M0r13n/pyais | MIT | PERMISSIVE | D | `8d0d0acc49` | M6 |  |
| maplibre/maplibre-gl-js | MIT | PERMISSIVE | D | `2a4c3728b6` | M6 |  |
| marchah/sea-ports | NOT FOUND | UNKNOWN | R | `3606d4d948` | M6 | was V; no clear licence: reference only until the author clarifies |
| mborsetti/airportsdata | MIT | PERMISSIVE | D | `47ae282a84` | M6 |  |
| mindee/doctr | Apache-2.0 | PERMISSIVE | D | `fac9585c13` | M6 |  |
| nodemailer/mailparser | MIT | PERMISSIVE | D | `e1882ddee1` | M6 |  |
| ocrmypdf/OCRmyPDF | MPL-2.0 | PERMISSIVE | S | `58048daf96` | M6 | MPL-2.0 file-level copyleft: call as CLI/sidecar, do not modify |
| openboxes/openboxes | EPL | STRONG | R | `b477674a4a` | M6 |  |
| opendatalab/MinerU | Apache-2.0 | PERMISSIVE | D* | `ed50cc15bc` | M6 | Apache-2.0 plus additional terms (commercial thresholds at 100M MAU or 20M USD monthly revenue, online-service attribution obligation): read LICENSE.md, then benchmark in M6 |
| PaddlePaddle/PaddleOCR | Apache-2.0 | PERMISSIVE | D | `dab3fe3537` | M6 |  |
| py-pdf/pypdf | BSD | PERMISSIVE | D | `4a50fe80d9` | M6 |  |
| schwehr/libais | Apache-2.0 | PERMISSIVE | D | `87dadfaa1b` | M6 |  |
| serwist/serwist | MIT | PERMISSIVE | D | `1b2ea2b397` | M6 |  |
| tesseract-ocr/tesseract | Apache-2.0 | PERMISSIVE | S | `09fe3f08b2` | M6 |  |
| Unstructured-IO/unstructured | Apache-2.0 | PERMISSIVE | D | `2e49ed91cd` | M6 |  |
| visgl/deck.gl | MIT | PERMISSIVE | D | `a1cca05adc` | M6 |  |
| adbar/trafilatura | Apache-2.0 | PERMISSIVE | D | `e2f85c9656` | M7 |  |
| aiogram/aiogram | MIT | PERMISSIVE | D | `b17c710ca9` | M7 |  |
| alex9smith/gdelt-doc-api | MIT | PERMISSIVE | D | `41220163fb` | M7 |  |
| amazon-science/chronos-forecasting | Apache-2.0 | PERMISSIVE | D | `1224fafa91` | M7 |  |
| apache/age | Apache-2.0 | PERMISSIVE | S | `3eeb20bd96` | M7 |  |
| CamDavidsonPilon/lifelines | MIT | PERMISSIVE | D | `7a8fc34a01` | M7 |  |
| deepcharles/ruptures | BSD | PERMISSIVE | D | `ee1c8ff8a5` | M7 |  |
| dgtlmoon/changedetection.io | Apache-2.0 | PERMISSIVE | S | `e8da5fc1f0` | M7 |  |
| DIYgod/RSSHub | AGPL-3.0 | STRONG | R | `7cda708a8f` | M7 | was S; copyleft / restricted: reference only, re-implement |
| dmlc/xgboost | Apache-2.0 | PERMISSIVE | D | `6aa5cf8c4c` | M7 |  |
| explosion/spaCy | MIT | PERMISSIVE | D | `c2dabfce56` | M7 |  |
| fabiankueppers/calibration-framework | Apache-2.0 | PERMISSIVE | D | `34b677f42b` | M7 |  |
| firecrawl/firecrawl | AGPL-3.0 | STRONG | R | `7cca3edf96` | M7 |  |
| genthalili/searoute-py | Apache-2.0 per PyPI (no LICENSE file found) | UNCONFIRMED | D* | `4446009a4c` | M7 | licence only declared on PyPI/registry: install from registry now; vendor only after LICENSE confirmed |
| geopandas/geopandas | BSD | PERMISSIVE | D | `2c7a442842` | M7 |  |
| GIScience/openrouteservice | GPL (2 or 3, see repo) | STRONG | R | `48c8f53c0e` | M7 |  |
| google-research/timesfm | Apache-2.0 | PERMISSIVE | R | `e51928e271` | M7 |  |
| google/or-tools | Apache-2.0 | PERMISSIVE | D | `100f66e624` | M7 |  |
| grammyjs/grammY | MIT | PERMISSIVE | R | `ee0c650ed0` | M7 |  |
| graphhopper/graphhopper | Apache-2.0 | PERMISSIVE | S | `1cc4d7bfde` | M7 |  |
| huggingface/transformers | Apache-2.0 | PERMISSIVE | D | `fa40619176` | M7 |  |
| kurtmckee/feedparser | BSD | PERMISSIVE | D | `a22c5521cb` | M7 |  |
| langchain-ai/langgraph | MIT | PERMISSIVE | D | `40a2e6d845` | M7 |  |
| MaartenGr/BERTopic | MIT | PERMISSIVE | D | `9036123c97` | M7 |  |
| microsoft/LightGBM | MIT | PERMISSIVE | D | `d8e422f871` | M7 |  |
| movingpandas/movingpandas | BSD | PERMISSIVE | D | `b321da5a7a` | M7 |  |
| networkx/networkx | BSD | PERMISSIVE | D | `6da4704cbf` | M7 |  |
| Nixtla/neuralforecast | Apache-2.0 | PERMISSIVE | R | `f02df84609` | M7 |  |
| Nixtla/statsforecast | Apache-2.0 | PERMISSIVE | D | `3e6789a89f` | M7 |  |
| novuhq/novu | MIT | PERMISSIVE | S | `d07cf17f57` | M7 |  |
| Open-Meteo/open-meteo | AGPL-3.0 | STRONG | R | `290493ffb9` | M7 | AGPL code; use only the hosted API under its terms (UNVERIFIED) |
| pgrouting/pgrouting | GPL-2.0 | STRONG | R | `bad15b5cfd` | M7 |  |
| Project-OSRM/osrm-backend | BSD-2-Clause | PERMISSIVE | S | `92eba58ec3` | M7 |  |
| PyVRP/PyVRP | MIT | PERMISSIVE | D | `22257ba1ed` | M7 |  |
| resend/react-email | MIT | PERMISSIVE | D | `9a181e04b6` | M7 |  |
| scikit-learn-contrib/MAPIE | BSD | PERMISSIVE | D | `f46a14b804` | M7 |  |
| scikit-mobility/scikit-mobility | BSD | PERMISSIVE | R | `9433d05a4c` | M7 |  |
| scrapy/scrapy | BSD | PERMISSIVE | D | `aef037d6fd` | M7 |  |
| sebp/scikit-survival | GPL (2 or 3, see repo) | STRONG | R | `8c1ed93443` | M7 |  |
| sktime/sktime | BSD | PERMISSIVE | R | `5ba6fba23e` | M7 |  |
| SYSTRAN/faster-whisper | MIT | PERMISSIVE | D | `9fa78645d7` | M7 |  |
| uber/h3-py | Apache-2.0 | PERMISSIVE | D | `c38c1e42c3` | M7 |  |
| unclecode/crawl4ai | Apache-2.0 | PERMISSIVE | D | `8afd0a6806` | M7 |  |
| unit8co/darts | Apache-2.0 | PERMISSIVE | D | `111504395d` | M7 |  |
| vacanza/holidays | MIT | PERMISSIVE | D | `96b73901a2` | M7 |  |
| valhalla/valhalla | MIT | PERMISSIVE | S | `e826f0c202` | M7 |  |
| VROOM-Project/vroom | BSD | PERMISSIVE | R | `07be776fc2` | M7 |  |
| WhiskeySockets/Baileys | MIT | PERMISSIVE | R | `0af2386292` | M7 |  |
| chatwoot/chatwoot | MIT | PERMISSIVE | S | `e6c21b63de` | M8 |  |
| decentralized-identity/veramo | Apache-2.0 | PERMISSIVE | R | `14acfc8615` | M8 |  |
| docusealco/docuseal | AGPL-3.0 | STRONG | R | `c6a7555f54` | M8 |  |
| formancehq/ledger | MIT | PERMISSIVE | R | `d47ba1746c` | M8 |  |
| getlago/lago | AGPL-3.0 | STRONG | R | `e399abbb20` | M8 |  |
| openwallet-foundation/credo-ts | Apache-2.0 | PERMISSIVE | R | `b2ac66a5f3` | M8 |  |
| pyca/cryptography | Apache-2.0 OR BSD-3-Clause | PERMISSIVE | D | `63feda2ab0` | M8 |  |
| sigstore/rekor | Apache-2.0 | PERMISSIVE | R | `042eebef21` | M8 |  |
| w3c-ccg/traceability-vocab | W3C CG licence | DOC | R | `961fb742f1` | M8 |  |
| w3c/vc-data-model | W3C licence | DOC | R | `69ebe41c22` | M8 |  |
| apache/superset | Apache-2.0 | PERMISSIVE | R | `100f51240b` | M9 |  |
| contentauth/c2pa-rs | MIT | PERMISSIVE | R | `58b9a09288` | M9 |  |
| locustio/locust | MIT | PERMISSIVE | D | `5187530e5d` | M9 |  |
| openfga/openfga | Apache-2.0 | PERMISSIVE | S | `526995eb20` | M9 |  |
| temporalio/temporal | MIT | PERMISSIVE | S | `d7f7d26196` | M9 |  |

## Package dependencies outside the permissive allowlist (reviewed)

`scripts/license_check.py` fails CI on any licence outside the allowlist unless it is listed here and in its `EXCEPTIONS`.

| Package | Licence | Why allowed | Reviewed |
|---|---|---|---|
| psycopg, psycopg-binary, psycopg-pool | LGPL-3.0-only | Policy 2: installed unmodified from PyPI, dynamically used, never vendored or edited | 2026-10-08 (M1) |
| @ibm/plex-sans | OFL-1.1 | **Proposed (owner to confirm):** fonts under the SIL Open Font License, used unmodified. OFL allows embedding in documents and bundling with software; it forbids selling the font alone and reusing the reserved name for modified versions, neither of which we do. Needed to embed the product font (full Kazakh Cyrillic, tabular figures) in report PDFs. The same font already ships to browsers via `next/font` (fetched at build time, so the npm scan never saw it). Licence text: `node_modules/@ibm/plex-sans/LICENSE.txt` | 2026-10-12 (M3); exception lands with harness PR #4 |
