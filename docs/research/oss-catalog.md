# Open-source catalogue: repos to install, vendor or learn from

Generated 2026-10-08 from a verification run. **Verified facts:** the repo exists, default branch, pinned commit SHA, last commit date, licence (read from the LICENSE file, with manual correction where the auto-read was wrong). **Not verified here:** stars, archived status, maintainer health, security posture (GitHub API was blocked in the session). Re-verify at the start of each phase (every prompt's OSS block says so).

**Counts:** 227 verified entries (elessarelfstone/kgd and elessarelfstone/tcomapi resolve to one repository, so 226 unique), 2 not found. Permissive: 201. Weak copyleft: 3. Reference-only because of licence: 4.

## Modes

- **D install (pinned dependency, wrapped)**
- **D* install from registry; vendor only after licence confirmed**
- **V vendor (copy into vendor/, keep LICENSE, adapt as native code)**
- **S sidecar service (HTTP only)**
- **R reference only (learn, re-implement, copy nothing)**

"Stays as native code" means: vendored code lives in `vendor/` at a pinned SHA with its LICENSE kept, is wrapped behind our module interface, and from then on we maintain it. It does not mean stripping licences. Copyleft (GPL/AGPL/BUSL/EPL) and unknown-licence repos are **reference only**: we study them and re-implement, copying no code. See `docs/compliance/third-party-licenses.md`.

## Killer features these unlock

| Feature | What the user gets | Built from | Prompt |
|---|---|---|---|
| **Tender Integrity Radar** | goszakup data -> OCDS -> procurement red flags (single bidder, bid rigging patterns, price anomalies) shown in every supplier dossier and RFQ | open-contracting/ocdskit, open-contracting/cardinal-rs, elessarelfstone/tcomapi, PyOD, Benford | M2, M4 |
| **Ownership X-ray** | Who really owns this supplier, and who do they own? Interactive graph with sanctions overlay | alephdata/followthemoney, opensanctions/nomenklatura, opensanctions/rigour, opensanctions/yente, openownership/data-standard, jacomyal/sigma.js, cytoscape/cytoscape.js | M4 |
| **EDS-signed sign-off** | Reviewer, client and approver sign reports, RFQ awards and decision records with the Kazakhstan electronic digital signature (legal effect and NCALayer terms UNVERIFIED) | sigex-kz/ncalayer-js-client, pyca/cryptography | M3, M5 |
| **Telegram-first coordinator** | Drivers and brokers send a text or voice note ("truck at Dostyk, 14:20"); it becomes a ShipmentEvent with source=manual/voice and a confidence. Kazakh speech quality UNVERIFIED; no unofficial WhatsApp clients | aiogram/aiogram, SYSTRAN/faster-whisper, novuhq/novu, chatwoot/chatwoot | M7, M8 |
| **Honest probabilistic ETA** | Baselines + zero-shot forecasts, survival models for dwell time, conformal intervals, calibration curves, KZ/CN/RU holiday calendars, regime-change detection on border queues | Nixtla/statsforecast, unit8co/darts, amazon-science/chronos-forecasting, CamDavidsonPilon/lifelines, scikit-learn-contrib/MAPIE, fabiankueppers/calibration-framework, vacanza/holidays, deepcharles/ruptures | M7 |
| **Multimodal what-if** | Sea + rail + road alternatives with cost/time/risk trade-offs on a live map | genthalili/searoute-py, Project-OSRM/osrm-backend, valhalla/valhalla, networkx/networkx, google/or-tools, PyVRP/PyVRP, visgl/deck.gl, maplibre/maplibre-gl-js | M7 |
| **Document Autopilot** | Drop a CMR/invoice/packing list; fields are extracted, cross-checked against the order, mismatches flagged | docling-project/docling, PaddlePaddle/PaddleOCR, mindee/doctr, invoice-x/invoice2data, getomni-ai/zerox, nodemailer/mailparser | M6 |
| **Self-improving matcher** | Every reviewer correction becomes training/eval data; prompts are optimised against golden sets; CI blocks regressions | moj-analytical-services/splink, dedupeio/dedupe, rapidfuzz/RapidFuzz, FlagOpen/FlagEmbedding, pgvector/pgvector, HumanSignal/label-studio, argilla-io/argilla, stanfordnlp/dspy, promptfoo/promptfoo | M2 |
| **Agent-ready API** | Customers' own AI agents call QazSupply read-only tools (with Evidence citations) over MCP; we also ship our own SKILL.md packs | jlowin/fastmcp, modelcontextprotocol/python-sdk, anthropics/claude-agent-sdk-python, mattpocock/skills (pattern) | M3, M9 |
| **Red-team in CI** | Every build attacks the assistant with injection suites and scans for PII leaks, with traces and cost per call | promptfoo/promptfoo, NVIDIA/garak, protectai/llm-guard, microsoft/presidio, langfuse/langfuse | M1, M3 |
| **Evidence drawer that feels native** | Drawer, command palette and toasts that behave like a native app; Liquid Glass on controls only | emilkowalski/vaul, pacocoursey/cmdk, emilkowalski/sonner, radix-ui/primitives, rdev/liquid-glass-react, juliangarnier/anime | M1 |
| **Verifiable batch passport (design)** | Signed, tamper-evident passport using W3C credentials and a transparency-log pattern; reference-only designs, implementation is ours | w3c/vc-data-model, w3c-ccg/traceability-vocab, sigstore/rekor, pyca/cryptography | M8 |

Every repo named above is in the tables below with its verified licence (some are written as short names, e.g. PyOD, Benford).

## Agent skills and MCP

Two directions: (1) skills and MCP servers we use to build (Playwright MCP, Context7, GitHub MCP, 21st Magic, plus skill-pattern repos), (2) skills and MCP tools we ship inside the product so customers' agents can use QazSupply. Layout for (2): `packages/agent-skills/` (see its README) holds QazSupply's own SKILL.md packs (spend audit, supplier vetting, RFQ comparison, shipment triage, customs-document check, risk brief) and the MCP server exposing read-only, tenant-scoped, Evidence-citing tools. Only Apache-2.0/MIT skill patterns may be adapted; the document skills in `anthropics/skills` are source-available and must not be copied.

## Engineering harness, CI and security scanning

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [aboutcode-org/scancode-toolkit](https://github.com/aboutcode-org/scancode-toolkit) | Apache-2.0 (auto-detect failed; confirm) | 2026-09-18 | `5e8448ecf2` | D | M0 | Licence and copyright scanner: CI gate for vendored code |
| [anchore/syft](https://github.com/anchore/syft) | Apache-2.0 | 2026-10-07 | `546c872c9d` | D | M0 | SBOM generator for images and repos |
| [aquasecurity/trivy](https://github.com/aquasecurity/trivy) | Apache-2.0 | 2026-10-07 | `3f664e55b7` | D | M0 | Scan containers, IaC and secrets |
| [astral-sh/ruff](https://github.com/astral-sh/ruff) | MIT | 2026-10-07 | `4830211afd` | D | M0 | Python lint and format |
| [astral-sh/uv](https://github.com/astral-sh/uv) | MIT | 2026-10-07 | `301799d971` | D | M0 | Python workspace and lockfile manager |
| [biomejs/biome](https://github.com/biomejs/biome) | MIT | 2026-10-08 | `c870caa641` | D | M0 | TS/JS lint and format |
| [CycloneDX/cyclonedx-python](https://github.com/CycloneDX/cyclonedx-python) | Apache-2.0 | 2026-09-29 | `fc119872ab` | D | M0 | Generate SBOM for Python |
| [gitleaks/gitleaks](https://github.com/gitleaks/gitleaks) | MIT | 2026-07-22 | `b58d3f102c` | D | M0 | Secret scanning in pre-commit and CI |
| [google/osv-scanner](https://github.com/google/osv-scanner) | Apache-2.0 | 2026-10-08 | `afb21ed4eb` | D | M0 | Vulnerability scan of dependencies |
| [pnpm/pnpm](https://github.com/pnpm/pnpm) | MIT | 2026-10-08 | `45e79172d8` | D | M0 | JS package manager |
| [pre-commit/pre-commit](https://github.com/pre-commit/pre-commit) | MIT | 2026-10-06 | `c4292384c9` | D | M0 | Git hook runner |
| [PyCQA/bandit](https://github.com/PyCQA/bandit) | Apache-2.0 | 2026-09-21 | `68ebe11ef7` | D | M0 | Python security linter |
| [pytest-dev/pytest](https://github.com/pytest-dev/pytest) | MIT | 2026-10-06 | `59200df778` | D | M0 | Python tests |
| [vercel/turborepo](https://github.com/vercel/turborepo) | MIT | 2026-10-07 | `7b470b6b86` | D | M0 | Monorepo task runner |
| [mswjs/msw](https://github.com/mswjs/msw) | MIT | 2026-10-05 | `501a591640` | D | M1 | Mock APIs in frontend tests |
| [schemathesis/schemathesis](https://github.com/schemathesis/schemathesis) | MIT | 2026-10-08 | `7efc851bbd` | D | M1 | Fuzz the API from its OpenAPI schema |
| [testcontainers/testcontainers-python](https://github.com/testcontainers/testcontainers-python) | Apache-2.0 | 2026-10-07 | `6146aa1170` | D | M1 | Real Postgres in tests (RLS) |
| [HypothesisWorks/hypothesis](https://github.com/HypothesisWorks/hypothesis) | MPL-2.0 | 2026-10-05 | `ca2a4c6e3c` | D | M2 | Property-based tests for parsers and savings math **Gate:** MPL-2.0: use unmodified as dependency. |
| [kevin1024/vcrpy](https://github.com/kevin1024/vcrpy) | MIT | 2026-07-04 | `c599974b31` | D | M4 | Record and replay external API calls as connector fixtures |
| [locustio/locust](https://github.com/locustio/locust) | MIT | 2026-10-04 | `5187530e5d` | D | M9 | Load testing |

## Entity resolution and fuzzy matching

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [dedupeio/dedupe](https://github.com/dedupeio/dedupe) | MIT | 2025-07-28 | `3f61e79102` | D | M2 | Active-learning deduplication, human-in-the-loop |
| [J535D165/recordlinkage](https://github.com/J535D165/recordlinkage) | BSD | 2023-07-20 | `b93d976419` | D | M2 | Record linkage toolkit, baseline comparator **Stale (last commit before 2025).** |
| [moj-analytical-services/splink](https://github.com/moj-analytical-services/splink) | MIT | 2026-10-06 | `68ced2a461` | V | M2 | Probabilistic record linkage: supplier and item dedupe at scale |
| [rapidfuzz/RapidFuzz](https://github.com/rapidfuzz/RapidFuzz) | MIT | 2026-09-12 | `db6e504539` | D | M2 | Fast fuzzy string matching for supplier/item names |
| [seatgeek/thefuzz](https://github.com/seatgeek/thefuzz) | MIT | 2025-03-03 | `1ba86f33a1` | D | M2 | Fuzzy matching helpers |
| [zinggAI/zingg](https://github.com/zinggAI/zingg) | AGPL-3.0 | 2026-09-13 | `9e3595a9ca` | R | M2 | ML entity resolution (study the approach) |
| [jamesturk/jellyfish](https://github.com/jamesturk/jellyfish) | MIT | 2025-11-22 | `b21046a4f0` | D | M4 | Phonetic and string distance for names |

## Sanctions, ownership and investigative graph

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [alephdata/aleph](https://github.com/alephdata/aleph) | MIT | 2025-12-19 | `fafcc8dfa4` | R | M4 | Investigative graph platform (ownership networks UX reference) |
| [alephdata/followthemoney](https://github.com/alephdata/followthemoney) | MIT | 2025-06-27 | `c70a89ffa5` | D | M4 | Data model for people, companies, ownership, money |
| [openaleph/openaleph](https://github.com/openaleph/openaleph) | MIT | 2026-10-07 | `93f25d8b20` | R | M4 | Maintained successor of Aleph |
| [openownership/data-standard](https://github.com/openownership/data-standard) | Apache-2.0 | 2026-09-02 | `e8cc3fd7a7` | V | M4 | Beneficial Ownership Data Standard (BODS) schema |
| [opensanctions/nomenklatura](https://github.com/opensanctions/nomenklatura) | MIT | 2026-10-07 | `c9224abbf4` | D | M4 | Entity matching and data-store for FollowTheMoney |
| [opensanctions/opensanctions](https://github.com/opensanctions/opensanctions) | MIT | 2026-10-07 | `ce59ef947b` | R | M4 | Crawlers and data model (data licence is non-commercial by default) |
| [opensanctions/rigour](https://github.com/opensanctions/rigour) | MIT | 2026-09-22 | `3cf1403590` | D | M4 | Name normalisation and transliteration for screening |
| [opensanctions/yente](https://github.com/opensanctions/yente) | MIT | 2026-10-01 | `28af9231b1` | S | M4 | Open matching API for sanctions/PEP data (self-hosted) |

## Public-procurement intelligence and red flags

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [open-contracting/standard](https://github.com/open-contracting/standard) | Apache-2.0 | 2026-10-06 | `8357b17f6d` | R | M0 | Open Contracting Data Standard specification |
| [open-contracting/cardinal-rs](https://github.com/open-contracting/cardinal-rs) | MIT | 2026-10-07 | `0b28400d90` | D | M2 | Procurement red-flag indicators (bid rigging, single bidder, etc.) |
| [open-contracting/kingfisher-collect](https://github.com/open-contracting/kingfisher-collect) | BSD | 2026-10-07 | `e17c985dbd` | R | M4 | Harvesting procurement data from public portals |
| [open-contracting/ocdskit](https://github.com/open-contracting/ocdskit) | BSD | 2026-10-06 | `eaa1a4466b` | D | M4 | OCDS tooling: convert procurement data to a standard |

## Kazakhstan and language layer

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [altynbek07/python-qazaq-transliterator](https://github.com/altynbek07/python-qazaq-transliterator) | MIT | 2021-02-25 | `5a1298ed57` | V | M2 | Old-to-new Kazakh alphabet transliteration **Stale (last commit before 2025).** |
| [apertium/apertium-kaz](https://github.com/apertium/apertium-kaz) | GPL (2 or 3, see repo) | 2023-11-01 | `95c6dd0d85` | R | M2 | Kazakh morphological analyser (study, use as service only if licence allows) **Stale (last commit before 2025).** |
| [FlagOpen/FlagEmbedding](https://github.com/FlagOpen/FlagEmbedding) | MIT | 2026-08-24 | `fd1a2bdf69` | D | M2 | BGE-M3 multilingual embeddings (kk/ru/en) |
| [natasha/natasha](https://github.com/natasha/natasha) | MIT | 2026-10-02 | `558bf509fa` | D | M2 | Russian NER and extraction |
| [no-plagiarism/pymorphy3](https://github.com/no-plagiarism/pymorphy3) | MIT | 2025-10-09 | `6bb7e85a6c` | D | M2 | Russian morphology and lemmatisation |
| [silvermete0r/QazNLTK](https://github.com/silvermete0r/QazNLTK) | MIT | 2026-06-22 | `a2f64b87e3` | D | M2 | Kazakh text processing |
| [UKPLab/sentence-transformers](https://github.com/UKPLab/sentence-transformers) | Apache-2.0 | 2026-10-08 | `68275ad5db` | D | M2 | Embedding framework, multilingual models |
| [sigex-kz/ncalayer-js-client](https://github.com/sigex-kz/ncalayer-js-client) | MIT | 2026-06-12 | `85faf4d5df` | D | M3 | NCALayer client: Kazakhstan EDS signing in the browser |
| [arthurdejong/python-stdnum](https://github.com/arthurdejong/python-stdnum) | LGPL (see repo) | 2026-08-15 | `006192e59b` | D | M4 | Validate tax/company ID numbers (check Kazakhstan coverage) **Gate:** LGPL: keep unmodified, dynamic install only. |
| [elessarelfstone/kgd](https://github.com/elessarelfstone/kgd) | MIT per PyPI (no LICENSE file in repo) | 2022-12-07 | `1ba333148d` | D* | M4 | Tax payments by Kazakhstan companies (same repository as tcomapi; check source terms) **Gate:** licence only declared on PyPI/registry: install from registry now; vendor only after LICENSE confirmed. **Stale (last commit before 2025).** |
| [elessarelfstone/tcomapi](https://github.com/elessarelfstone/tcomapi) | MIT per PyPI (no LICENSE file in repo) | 2022-12-07 | `1ba333148d` | D* | M4 | Open-data bundle for Kazakhstan sites (goszakup and others) **Gate:** licence only declared on PyPI/registry: install from registry now; vendor only after LICENSE confirmed. **Stale (last commit before 2025).** |

## Document AI, OCR and ingestion

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [jsvine/pdfplumber](https://github.com/jsvine/pdfplumber) | MIT | 2026-06-14 | `4c64b92d5c` | D | M2 | PDF tables and text |
| [microsoft/markitdown](https://github.com/microsoft/markitdown) | MIT | 2026-10-03 | `4cc9fa1765` | D | M2 | Office/PDF to Markdown for LLM ingestion |
| [camelot-dev/camelot](https://github.com/camelot-dev/camelot) | MIT | 2026-10-06 | `b300e9e31a` | D | M6 | PDF table extraction |
| [datalab-to/marker](https://github.com/datalab-to/marker) | Apache-2.0 | 2026-10-02 | `e7c67f1d23` | D* | M6 | High-quality PDF to Markdown; benchmark against Docling. **Gate:** code is Apache-2.0; model weights use a modified OpenRAIL-M (free for research, personal and startups under 5M USD funding/revenue; paid beyond): read the weights terms, then benchmark in M6. |
| [docling-project/docling](https://github.com/docling-project/docling) | MIT | 2026-10-08 | `9590eb4955` | D | M6 | PDF/DOCX/image parsing to structured documents |
| [getomni-ai/zerox](https://github.com/getomni-ai/zerox) | MIT | 2025-05-19 | `91bbb20c50` | V | M6 | Vision-LLM OCR pattern for hard scans |
| [invoice-x/invoice2data](https://github.com/invoice-x/invoice2data) | MIT | 2026-10-06 | `09378126e3` | V | M6 | Template-based invoice field extraction |
| [kreuzberg-dev/kreuzberg](https://github.com/kreuzberg-dev/kreuzberg) | MIT | 2026-10-08 | `4a5d57f225` | D | M6 | Fast multi-format text extraction |
| [mindee/doctr](https://github.com/mindee/doctr) | Apache-2.0 | 2026-10-07 | `fac9585c13` | D | M6 | OCR and layout in PyTorch |
| [nodemailer/mailparser](https://github.com/nodemailer/mailparser) | MIT | 2026-10-05 | `e1882ddee1` | D | M6 | Parse inbound emails and attachments |
| [ocrmypdf/OCRmyPDF](https://github.com/ocrmypdf/OCRmyPDF) | MPL-2.0 | 2026-10-07 | `58048daf96` | S | M6 | Make scanned PDFs searchable **Gate:** MPL-2.0 file-level copyleft: call as CLI/sidecar, do not modify. |
| [opendatalab/MinerU](https://github.com/opendatalab/MinerU) | Apache-2.0 | 2026-09-29 | `ed50cc15bc` | D* | M6 | Document extraction; benchmark against Docling. **Gate:** Apache-2.0 plus additional terms (commercial thresholds at 100M MAU or 20M USD monthly revenue, online-service attribution obligation): read LICENSE.md, then benchmark in M6. |
| [PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | Apache-2.0 | 2026-09-16 | `dab3fe3537` | D | M6 | Multilingual OCR including Cyrillic |
| [py-pdf/pypdf](https://github.com/py-pdf/pypdf) | BSD | 2026-10-08 | `4a50fe80d9` | D | M6 | PDF manipulation |
| [tesseract-ocr/tesseract](https://github.com/tesseract-ocr/tesseract) | Apache-2.0 | 2026-10-07 | `09fe3f08b2` | S | M6 | Baseline OCR engine (kaz, rus traineddata) |
| [Unstructured-IO/unstructured](https://github.com/Unstructured-IO/unstructured) | Apache-2.0 | 2026-10-08 | `2e49ed91cd` | D | M6 | Document partitioning pipeline |

## LLM engineering and agent frameworks

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [567-labs/instructor](https://github.com/567-labs/instructor) | MIT | 2026-09-10 | `e12f8b4920` | D | M1 | Structured outputs from LLMs with validation |
| [anthropics/anthropic-sdk-python](https://github.com/anthropics/anthropic-sdk-python) | MIT | 2026-10-08 | `50b78d17a8` | D | M1 | Official Claude SDK |
| [BerriAI/litellm](https://github.com/BerriAI/litellm) | MIT | 2026-10-08 | `7c7efd4d55` | D | M1 | Provider gateway, budgets, fallbacks |
| [dottxt-ai/outlines](https://github.com/dottxt-ai/outlines) | Apache-2.0 | 2026-08-24 | `c52af8472c` | R | M2 | Constrained generation (choose only among retrieved codes) |
| [stanfordnlp/dspy](https://github.com/stanfordnlp/dspy) | MIT | 2026-10-07 | `a7e7edb8c6` | D | M2 | Optimise prompts against our golden sets |
| [anthropics/claude-agent-sdk-python](https://github.com/anthropics/claude-agent-sdk-python) | MIT | 2026-10-07 | `f7b0b62c2a` | D | M3 | Agent SDK for tool-using assistants |
| [pydantic/pydantic-ai](https://github.com/pydantic/pydantic-ai) | MIT | 2026-10-07 | `f55bb8a6fd` | D | M3 | Typed agent framework |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | MIT | 2026-10-07 | `40a2e6d845` | D | M7 | Stateful agent graphs with human-in-the-loop interrupts |

## Agent tooling, MCP servers and skills

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [anthropics/skills](https://github.com/anthropics/skills) | Mixed: Apache-2.0 skills + source-available doc skills | 2026-10-05 | `683bc88e56` | R | M0 | Reference skills (docx, pdf, xlsx, pptx) and SKILL.md patterns **Gate:** copy nothing from docx/pdf/pptx/xlsx skills (source-available); Apache skills only as patterns. |
| [github/github-mcp-server](https://github.com/github/github-mcp-server) | MIT | 2026-10-07 | `55edd58d5e` | S | M0 | GitHub MCP |
| [mattpocock/skills](https://github.com/mattpocock/skills) | MIT | 2026-10-07 | `f3fc5632f4` | R | M0 | Engineering skill chain used in this project |
| [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | Apache-2.0 | 2026-10-07 | `a6d7678b7b` | S | M0 | Playwright MCP for agent testing |
| [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | Apache-2.0 | 2026-10-04 | `5abed86c53` | R | M0 | Reference MCP servers |
| [obra/superpowers](https://github.com/obra/superpowers) | MIT | 2026-09-25 | `8ca22dba9a` | R | M0 | Agent workflow skills (study) |
| [upstash/context7](https://github.com/upstash/context7) | MIT | 2026-10-08 | `ba9d74c4da` | S | M0 | Up-to-date library docs for agents |
| [21st-dev/magic-mcp](https://github.com/21st-dev/magic-mcp) | ISC | 2026-09-09 | `6b5299e8a8` | S | M1 | UI component generation MCP |
| [anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks) | MIT | 2026-09-28 | `d7265d6ae9` | R | M3 | Patterns: tool use, RAG, citations, evals |
| [jlowin/fastmcp](https://github.com/jlowin/fastmcp) | Apache-2.0 | 2026-10-04 | `5baeacfe20` | D | M3 | Fast way to publish our services as MCP servers |
| [modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk) | MIT | 2026-10-05 | `91941ed4d3` | D | M3 | MCP server SDK (expose Evidence and analysis as tools) |

## LLM evaluation, red-team, privacy and observability

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [langfuse/langfuse](https://github.com/langfuse/langfuse) | MIT | 2026-10-08 | `3d680c019d` | S | M1 | LLM tracing, cost, prompt versions (self-host) |
| [microsoft/presidio](https://github.com/microsoft/presidio) | MIT | 2026-10-08 | `2523c7b74a` | D | M1 | PII detection and redaction before LLM calls |
| [confident-ai/deepeval](https://github.com/confident-ai/deepeval) | Apache-2.0 | 2026-10-07 | `0fb05d028b` | D | M2 | LLM eval metrics |
| [explodinggradients/ragas](https://github.com/explodinggradients/ragas) | Apache-2.0 | 2026-02-24 | `298b682742` | D | M3 | RAG groundedness metrics |
| [guardrails-ai/guardrails](https://github.com/guardrails-ai/guardrails) | Apache-2.0 | 2026-08-26 | `06d0ff2c5f` | R | M3 | Validators for LLM output |
| [NVIDIA/garak](https://github.com/NVIDIA/garak) | Apache-2.0 | 2026-10-07 | `aa5262f13d` | D | M3 | LLM vulnerability scanner |
| [NVIDIA/NeMo-Guardrails](https://github.com/NVIDIA/NeMo-Guardrails) | Apache-2.0 | 2026-10-07 | `9f793de53e` | R | M3 | Guardrail patterns |
| [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) | MIT | 2026-10-08 | `bbb583afc8` | D | M3 | Eval and red-team harness in CI |
| [protectai/llm-guard](https://github.com/protectai/llm-guard) | MIT | 2026-07-09 | `168c1034ff` | D | M3 | Input/output scanners (injection, PII) |

## Logistics: tracking, routing, maritime, geo

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [datasets/un-locode](https://github.com/datasets/un-locode) | NOT FOUND in repo | 2026-07-27 | `b1309b37ed` | R | M6 | UN/LOCODE port and terminal codes **Gate:** was V; no clear licence: reference only until the author clarifies. |
| [jkeen/tracking_number](https://github.com/jkeen/tracking_number) | MIT | 2026-08-15 | `4e30609478` | R | M6 | Carrier tracking-number patterns (port the rules) |
| [karrioapi/karrio](https://github.com/karrioapi/karrio) | LGPL (see repo) | 2026-06-23 | `deea10f856` | S | M6 | Multi-carrier shipping/tracking API. **Gate:** LGPL-3.0 core run as a separate service; the ee/ directory has a separate commercial licence: never use ee/. |
| [M0r13n/pyais](https://github.com/M0r13n/pyais) | MIT | 2026-10-04 | `8d0d0acc49` | D | M6 | Decode AIS vessel messages |
| [marchah/sea-ports](https://github.com/marchah/sea-ports) | NOT FOUND | 2022-06-28 | `3606d4d948` | R | M6 | Seaport dataset **Gate:** was V; no clear licence: reference only until the author clarifies. **Stale (last commit before 2025).** |
| [mborsetti/airportsdata](https://github.com/mborsetti/airportsdata) | MIT | 2026-09-05 | `47ae282a84` | D | M6 | Airport dataset |
| [schwehr/libais](https://github.com/schwehr/libais) | Apache-2.0 | 2026-06-30 | `87dadfaa1b` | D | M6 | AIS decoding in C++ with Python bindings |
| [genthalili/searoute-py](https://github.com/genthalili/searoute-py) | Apache-2.0 per PyPI (no LICENSE file found) | 2026-05-17 | `4446009a4c` | D* | M7 | Shortest sea route between two points **Gate:** licence only declared on PyPI/registry: install from registry now; vendor only after LICENSE confirmed. |
| [geopandas/geopandas](https://github.com/geopandas/geopandas) | BSD | 2026-10-07 | `2c7a442842` | D | M7 | Geospatial dataframes |
| [GIScience/openrouteservice](https://github.com/GIScience/openrouteservice) | GPL (2 or 3, see repo) | 2026-10-07 | `48c8f53c0e` | R | M7 | Routing platform (copyleft: study only) |
| [google/or-tools](https://github.com/google/or-tools) | Apache-2.0 | 2026-09-17 | `100f66e624` | D | M7 | Optimisation: reroute, consolidation, load planning |
| [graphhopper/graphhopper](https://github.com/graphhopper/graphhopper) | Apache-2.0 | 2026-10-07 | `1cc4d7bfde` | S | M7 | Road routing engine |
| [movingpandas/movingpandas](https://github.com/movingpandas/movingpandas) | BSD | 2026-09-30 | `b321da5a7a` | D | M7 | Trajectory analysis: dwell, stops, speed |
| [networkx/networkx](https://github.com/networkx/networkx) | BSD | 2026-10-06 | `6da4704cbf` | D | M7 | Route graph and ownership graph algorithms |
| [pgrouting/pgrouting](https://github.com/pgrouting/pgrouting) | GPL-2.0 | 2026-10-07 | `bad15b5cfd` | R | M7 | Routing inside Postgres (copyleft) |
| [Project-OSRM/osrm-backend](https://github.com/Project-OSRM/osrm-backend) | BSD-2-Clause | 2026-10-07 | `92eba58ec3` | S | M7 | Road routing engine |
| [PyVRP/PyVRP](https://github.com/PyVRP/PyVRP) | MIT | 2026-09-30 | `22257ba1ed` | D | M7 | Vehicle routing solver |
| [scikit-mobility/scikit-mobility](https://github.com/scikit-mobility/scikit-mobility) | BSD | 2023-01-20 | `9433d05a4c` | R | M7 | Mobility analysis **Stale (last commit before 2025).** |
| [uber/h3-py](https://github.com/uber/h3-py) | Apache-2.0 | 2026-09-08 | `c38c1e42c3` | D | M7 | Hex grid indexing for geo aggregation |
| [vacanza/holidays](https://github.com/vacanza/holidays) | MIT | 2026-10-08 | `96b73901a2` | D | M7 | Public holidays for KZ, UZ, KG, RU, CN: border and ETA seasonality |
| [valhalla/valhalla](https://github.com/valhalla/valhalla) | MIT | 2026-10-07 | `e826f0c202` | S | M7 | Multimodal routing engine |
| [VROOM-Project/vroom](https://github.com/VROOM-Project/vroom) | BSD | 2026-03-17 | `07be776fc2` | R | M7 | Routing optimisation engine |

## Forecasting, ETA, calibration, anomaly detection

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [milcent/benford_py](https://github.com/milcent/benford_py) | BSD | 2022-10-11 | `0126c606ae` | D | M2 | Benford analysis for invoice fraud signals **Stale (last commit before 2025).** |
| [yzhao062/pyod](https://github.com/yzhao062/pyod) | BSD | 2026-09-16 | `3a71f47bb2` | D | M2 | Outlier detection for price anomalies |
| [amazon-science/chronos-forecasting](https://github.com/amazon-science/chronos-forecasting) | Apache-2.0 | 2026-10-05 | `1224fafa91` | D | M7 | Pretrained probabilistic forecasting for sparse routes |
| [CamDavidsonPilon/lifelines](https://github.com/CamDavidsonPilon/lifelines) | MIT | 2026-03-06 | `7a8fc34a01` | D | M7 | Survival analysis for dwell and delay times |
| [deepcharles/ruptures](https://github.com/deepcharles/ruptures) | BSD | 2026-05-26 | `ee1c8ff8a5` | D | M7 | Change-point detection for queue times |
| [dmlc/xgboost](https://github.com/dmlc/xgboost) | Apache-2.0 | 2026-10-08 | `6aa5cf8c4c` | D | M7 | Gradient boosting |
| [fabiankueppers/calibration-framework](https://github.com/fabiankueppers/calibration-framework) | Apache-2.0 | 2026-04-16 | `34b677f42b` | D | M7 | Probability calibration metrics (netcal) |
| [google-research/timesfm](https://github.com/google-research/timesfm) | Apache-2.0 | 2026-09-29 | `e51928e271` | R | M7 | Pretrained time-series model |
| [microsoft/LightGBM](https://github.com/microsoft/LightGBM) | MIT | 2026-10-04 | `d8e422f871` | D | M7 | Gradient boosting for ETA features |
| [Nixtla/neuralforecast](https://github.com/Nixtla/neuralforecast) | Apache-2.0 | 2026-10-07 | `f02df84609` | R | M7 | Neural forecasting |
| [Nixtla/statsforecast](https://github.com/Nixtla/statsforecast) | Apache-2.0 | 2026-10-07 | `3e6789a89f` | D | M7 | Fast statistical forecasting baselines |
| [scikit-learn-contrib/MAPIE](https://github.com/scikit-learn-contrib/MAPIE) | BSD | 2026-10-07 | `f46a14b804` | D | M7 | Conformal prediction intervals for ETA |
| [sebp/scikit-survival](https://github.com/sebp/scikit-survival) | GPL (2 or 3, see repo) | 2026-10-04 | `8c1ed93443` | R | M7 | Survival models (copyleft: study only) |
| [sktime/sktime](https://github.com/sktime/sktime) | BSD | 2026-10-04 | `5ba6fba23e` | R | M7 | Time-series ML toolkit |
| [unit8co/darts](https://github.com/unit8co/darts) | Apache-2.0 | 2026-10-08 | `111504395d` | D | M7 | Forecasting toolkit with probabilistic models |

## Risk radar: crawling, news, NLP, speech

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [adbar/trafilatura](https://github.com/adbar/trafilatura) | Apache-2.0 | 2026-10-06 | `e2f85c9656` | D | M7 | Clean text extraction from news pages |
| [alex9smith/gdelt-doc-api](https://github.com/alex9smith/gdelt-doc-api) | MIT | 2025-04-22 | `41220163fb` | D | M7 | GDELT news/event search client |
| [dgtlmoon/changedetection.io](https://github.com/dgtlmoon/changedetection.io) | Apache-2.0 | 2026-10-07 | `e8da5fc1f0` | S | M7 | Watch official notices for changes |
| [DIYgod/RSSHub](https://github.com/DIYgod/RSSHub) | AGPL-3.0 | 2026-10-08 | `7cda708a8f` | R | M7 | RSS for sites without feeds **Gate:** was S; copyleft / restricted: reference only, re-implement. |
| [explosion/spaCy](https://github.com/explosion/spaCy) | MIT | 2026-09-30 | `c2dabfce56` | D | M7 | NLP pipelines |
| [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) | AGPL-3.0 | 2026-10-08 | `7cca3edf96` | R | M7 | Crawler API (copyleft: study only) |
| [huggingface/transformers](https://github.com/huggingface/transformers) | Apache-2.0 | 2026-10-08 | `fa40619176` | D | M7 | Model library |
| [kurtmckee/feedparser](https://github.com/kurtmckee/feedparser) | BSD | 2026-07-30 | `a22c5521cb` | D | M7 | Parse RSS/Atom |
| [MaartenGr/BERTopic](https://github.com/MaartenGr/BERTopic) | MIT | 2026-08-27 | `9036123c97` | D | M7 | Cluster alerts and news topics |
| [Open-Meteo/open-meteo](https://github.com/Open-Meteo/open-meteo) | AGPL-3.0 | 2026-10-06 | `290493ffb9` | R | M7 | Weather API (copyleft code: use the hosted API terms, do not embed) **Gate:** AGPL code; use only the hosted API under its terms (UNVERIFIED). |
| [scrapy/scrapy](https://github.com/scrapy/scrapy) | BSD | 2026-10-07 | `aef037d6fd` | D | M7 | Crawling framework |
| [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) | MIT | 2026-10-06 | `9fa78645d7` | D | M7 | Speech-to-text for voice notes (Kazakh quality UNVERIFIED) |
| [unclecode/crawl4ai](https://github.com/unclecode/crawl4ai) | Apache-2.0 | 2026-10-05 | `8afd0a6806` | D | M7 | LLM-friendly crawler |

## Messaging and notifications

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [aiogram/aiogram](https://github.com/aiogram/aiogram) | MIT | 2026-09-27 | `b17c710ca9` | D | M7 | Telegram bot framework |
| [grammyjs/grammY](https://github.com/grammyjs/grammY) | MIT | 2026-09-27 | `ee0c650ed0` | R | M7 | Telegram bot framework (TS) |
| [novuhq/novu](https://github.com/novuhq/novu) | MIT | 2026-10-08 | `d07cf17f57` | S | M7 | Notification infrastructure |
| [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys) | MIT | 2026-08-04 | `0af2386292` | R | M7 | Unofficial WhatsApp client (ToS risk: do not ship) |
| [chatwoot/chatwoot](https://github.com/chatwoot/chatwoot) | MIT | 2026-10-07 | `e6c21b63de` | S | M8 | Omnichannel inbox for supplier conversations |

## Labelling and human review tooling

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [argilla-io/argilla](https://github.com/argilla-io/argilla) | Apache-2.0 | 2025-08-05 | `5338519acc` | S | M2 | Review and feedback UI for LLM data |
| [doccano/doccano](https://github.com/doccano/doccano) | MIT | 2026-01-17 | `ab6b765ea3` | R | M2 | Annotation tool |
| [HumanSignal/label-studio](https://github.com/HumanSignal/label-studio) | Apache-2.0 | 2026-10-08 | `766b7ce5c6` | S | M2 | Labelling UI for golden sets |

## Frontend, design system, charts, graphs, maps

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [microsoft/playwright](https://github.com/microsoft/playwright) | Apache-2.0 | 2026-10-07 | `4357c237cf` | D | M0 | End-to-end tests |
| [amannn/next-intl](https://github.com/amannn/next-intl) | MIT | 2026-10-02 | `b9fc98a814` | D | M1 | i18n for Next.js (kk, ru, en, uz) |
| [colinhacks/zod](https://github.com/colinhacks/zod) | MIT | 2026-10-02 | `0b216ef674` | D | M1 | Schema validation shared client/server |
| [dequelabs/axe-core](https://github.com/dequelabs/axe-core) | MPL-2.0 | 2026-10-07 | `cfd2ea6004` | D | M1 | Accessibility checks in Playwright **Gate:** MPL-2.0: use unmodified as dependency. |
| [emilkowalski/sonner](https://github.com/emilkowalski/sonner) | MIT | 2026-08-10 | `8e4662b392` | D | M1 | Toasts |
| [emilkowalski/vaul](https://github.com/emilkowalski/vaul) | MIT | 2025-10-03 | `3e97aac6a3` | D | M1 | Drawer: base for the Evidence drawer |
| [ibelick/motion-primitives](https://github.com/ibelick/motion-primitives) | NOT FOUND | 2026-09-28 | `120f64f6ca` | R | M1 | Motion components, copy-in model **Gate:** was V; no clear licence: reference only until the author clarifies. |
| [juliangarnier/anime](https://github.com/juliangarnier/anime) | MIT | 2026-08-09 | `01b81be1df` | D | M1 | anime.js v4 animation engine |
| [lost-pixel/lost-pixel](https://github.com/lost-pixel/lost-pixel) | MIT | 2026-04-22 | `f08221fc2a` | D | M1 | Visual regression |
| [magicuidesign/magicui](https://github.com/magicuidesign/magicui) | MIT | 2026-10-05 | `cdb348cb4c` | V | M1 | Animated components, copy-in model |
| [motiondivision/motion](https://github.com/motiondivision/motion) | MIT | 2026-10-05 | `55eb6bbd5f` | R | M1 | Alternative animation library (compare) |
| [pacocoursey/cmdk](https://github.com/pacocoursey/cmdk) | MIT | 2025-10-28 | `dd2250ed60` | D | M1 | Command palette |
| [python-babel/babel](https://github.com/python-babel/babel) | BSD | 2026-09-22 | `e2a17919f0` | D | M1 | Locale formatting for numbers, dates, currency |
| [radix-ui/primitives](https://github.com/radix-ui/primitives) | MIT | 2026-10-07 | `4e8b0dbc76` | D | M1 | Accessible primitives |
| [rdev/liquid-glass-react](https://github.com/rdev/liquid-glass-react) | MIT | 2025-06-13 | `ac48eab18d` | D | M1 | Liquid Glass effect component (controls layer only) |
| [recharts/recharts](https://github.com/recharts/recharts) | MIT | 2026-10-08 | `189c0d71c3` | D | M1 | Charts |
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | MIT | 2026-10-07 | `97ddbf4274` | V | M1 | Component source we copy into packages/ui |
| [storybookjs/storybook](https://github.com/storybookjs/storybook) | MIT | 2026-10-08 | `33217def5a` | D | M1 | Component gallery |
| [TanStack/query](https://github.com/TanStack/query) | MIT | 2026-10-08 | `01a7ebdd02` | D | M1 | Server-state caching |
| [TanStack/table](https://github.com/TanStack/table) | MIT | 2026-10-07 | `6aa0d74946` | D | M1 | Headless tables |
| [dream-num/univer](https://github.com/dream-num/univer) | Apache-2.0 | 2026-10-08 | `7efa462dbb` | D | M2 | Spreadsheet engine for column mapping preview |
| [glideapps/glide-data-grid](https://github.com/glideapps/glide-data-grid) | MIT | 2026-01-21 | `0875d78cc4` | D | M2 | Fast canvas data grid |
| [mholt/PapaParse](https://github.com/mholt/PapaParse) | MIT | 2026-09-15 | `4843fc2021` | D | M2 | CSV parsing in the browser |
| [react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form) | MIT | 2026-10-08 | `e76876b025` | D | M2 | Forms |
| [SheetJS/sheetjs](https://github.com/SheetJS/sheetjs) | Apache-2.0 | 2024-01-31 | `3f44ddd99c` | D | M2 | Excel parsing **Stale (last commit before 2025).** |
| [TanStack/virtual](https://github.com/TanStack/virtual) | MIT | 2026-09-14 | `78371e851e` | D | M2 | Virtualised lists for 50k-row previews |
| [airbnb/visx](https://github.com/airbnb/visx) | MIT | 2026-06-22 | `485c035966` | D | M3 | Low-level custom charts (dot plots, bands) |
| [apache/echarts](https://github.com/apache/echarts) | Apache-2.0 | 2026-10-04 | `34f4d927ea` | D | M3 | Rich charts (Pareto, probability bands) |
| [assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui) | MIT | 2026-10-08 | `6ca5ca4080` | D | M3 | Chat UI primitives with streaming and citations |
| [diegomura/react-pdf](https://github.com/diegomura/react-pdf) | MIT | 2026-09-22 | `e7b14db1e5` | D | M3 | PDF report generation |
| [exceljs/exceljs](https://github.com/exceljs/exceljs) | MIT | 2024-01-12 | `5bed18b45e` | D | M3 | Excel export **Stale (last commit before 2025).** |
| [vercel/ai](https://github.com/vercel/ai) | Apache-2.0 | 2026-10-08 | `5028fa46b4` | D | M3 | AI SDK for streaming UI |
| [cytoscape/cytoscape.js](https://github.com/cytoscape/cytoscape.js) | MIT | 2026-09-07 | `7ba634095d` | D | M4 | Graph visualisation and analysis |
| [jacomyal/sigma.js](https://github.com/jacomyal/sigma.js) | MIT | 2026-04-30 | `d32c4e5bfd` | D | M4 | Large graph rendering |
| [xyflow/xyflow](https://github.com/xyflow/xyflow) | MIT | 2026-09-24 | `3d35b57317` | D | M4 | Node/edge graphs (ownership, route graph) |
| [maplibre/maplibre-gl-js](https://github.com/maplibre/maplibre-gl-js) | MIT | 2026-10-07 | `2a4c3728b6` | D | M6 | Open map rendering |
| [serwist/serwist](https://github.com/serwist/serwist) | MIT | 2026-10-04 | `1b2ea2b397` | D | M6 | PWA and offline for coordinators |
| [visgl/deck.gl](https://github.com/visgl/deck.gl) | MIT | 2026-10-07 | `a1cca05adc` | D | M6 | Flow arcs and layers for corridors |
| [resend/react-email](https://github.com/resend/react-email) | MIT | 2026-10-07 | `9a181e04b6` | D | M7 | Email templates for digests |

## Backend, data, queues, search, auth

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [fastapi/fastapi](https://github.com/fastapi/fastapi) | MIT | 2026-10-07 | `9269f17524` | D | M1 | API framework |
| [procrastinate-org/procrastinate](https://github.com/procrastinate-org/procrastinate) | MIT | 2026-10-05 | `1548b3ef26` | D | M1 | Postgres-backed task queue for Python |
| [sqlalchemy/alembic](https://github.com/sqlalchemy/alembic) | MIT | 2026-10-03 | `1bc21b86dd` | D | M1 | Migrations (if used beside Supabase) |
| [supabase/supabase](https://github.com/supabase/supabase) | Apache-2.0 | 2026-10-08 | `af3e397e7f` | S | M1 | Postgres, auth, storage, RLS |
| [supabase/supabase-py](https://github.com/supabase/supabase-py) | MIT | 2026-10-07 | `dfae141929` | D | M1 | Python client |
| [tembo-io/pgmq](https://github.com/tembo-io/pgmq) | PostgreSQL | 2026-09-26 | `8cc0959b24` | R | M1 | Postgres message queue extension |
| [theory/pgtap](https://github.com/theory/pgtap) | PostgreSQL (per README) | 2026-09-27 | `21ceed193b` | D | M1 | Database tests for RLS policies |
| [timgit/pg-boss](https://github.com/timgit/pg-boss) | MIT | 2026-10-07 | `05dc216001` | D | M1 | Postgres-backed queue for Node |
| [duckdb/duckdb](https://github.com/duckdb/duckdb) | MIT | 2026-10-08 | `26e63077ac` | D | M2 | Analytical engine for audit math and Splink backend |
| [pgvector/pgvector](https://github.com/pgvector/pgvector) | PostgreSQL | 2026-10-01 | `f37c13f68b` | S | M2 | Vector search in Postgres |
| [pola-rs/polars](https://github.com/pola-rs/polars) | MIT | 2026-10-08 | `4906180985` | D | M2 | Fast dataframes |
| [citusdata/pg_cron](https://github.com/citusdata/pg_cron) | PostgreSQL-style permissive | 2026-09-08 | `5cedfa472c` | S | M4 | Scheduled re-screening inside Postgres |
| [meilisearch/meilisearch](https://github.com/meilisearch/meilisearch) | MIT + BUSL-1.1 (EE parts) | 2026-10-07 | `e958ee3edd` | S | M5 | Typo-tolerant catalogue search **Gate:** use MIT core only, never enable EE features. |
| [typesense/typesense](https://github.com/typesense/typesense) | GPL (2 or 3, see repo) | 2026-10-08 | `86a3337b65` | R | M5 | Search engine (copyleft: study only) |
| [apache/age](https://github.com/apache/age) | Apache-2.0 | 2026-09-29 | `3eeb20bd96` | S | M7 | Graph queries inside Postgres |
| [formancehq/ledger](https://github.com/formancehq/ledger) | MIT | 2026-10-05 | `d47ba1746c` | R | M8 | Programmable ledger (study for payment milestones) |
| [getlago/lago](https://github.com/getlago/lago) | AGPL-3.0 | 2026-10-08 | `e399abbb20` | R | M8 | Usage billing (copyleft: study only) |
| [openfga/openfga](https://github.com/openfga/openfga) | Apache-2.0 | 2026-10-07 | `526995eb20` | S | M9 | Fine-grained authorisation |
| [temporalio/temporal](https://github.com/temporalio/temporal) | MIT | 2026-10-07 | `d7f7d26196` | S | M9 | Durable workflows for customs/onboarding |

## Data quality, observability, BI

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [open-telemetry/opentelemetry-python](https://github.com/open-telemetry/opentelemetry-python) | Apache-2.0 | 2026-10-07 | `319d84a7f1` | D | M1 | Tracing |
| [great-expectations/great_expectations](https://github.com/great-expectations/great_expectations) | Apache-2.0 | 2026-10-07 | `9ba940cb7c` | R | M2 | Data-quality patterns |
| [unionai-oss/pandera](https://github.com/unionai-oss/pandera) | MIT | 2026-10-07 | `eb7b679b0c` | D | M2 | Dataframe validation |
| [apache/superset](https://github.com/apache/superset) | Apache-2.0 | 2026-10-08 | `100f51240b` | R | M9 | BI dashboards for internal ops |

## Traceability, passport, signing, provenance

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [decentralized-identity/veramo](https://github.com/decentralized-identity/veramo) | Apache-2.0 | 2026-10-06 | `14acfc8615` | R | M8 | Verifiable credentials framework |
| [openwallet-foundation/credo-ts](https://github.com/openwallet-foundation/credo-ts) | Apache-2.0 | 2026-10-07 | `b2ac66a5f3` | R | M8 | Verifiable credentials in TypeScript |
| [pyca/cryptography](https://github.com/pyca/cryptography) | Apache-2.0 OR BSD-3-Clause | 2026-10-07 | `63feda2ab0` | D | M8 | Signing and key handling |
| [sigstore/rekor](https://github.com/sigstore/rekor) | Apache-2.0 | 2026-10-05 | `042eebef21` | R | M8 | Transparency log (tamper-evident audit pattern) |
| [w3c-ccg/traceability-vocab](https://github.com/w3c-ccg/traceability-vocab) | W3C CG licence | 2024-12-04 | `961fb742f1` | R | M8 | W3C traceability vocabulary **Stale (last commit before 2025).** |
| [w3c/vc-data-model](https://github.com/w3c/vc-data-model) | W3C licence | 2026-09-30 | `69ebe41c22` | R | M8 | Verifiable Credentials data model |
| [contentauth/c2pa-rs](https://github.com/contentauth/c2pa-rs) | MIT | 2026-10-06 | `58b9a09288` | R | M9 | Content provenance for inspector photos |

## Reference ERP and supply-chain apps

| Repo | Licence (verified) | Last commit | Pin | Mode | Prompt | Why / note |
|---|---|---|---|---|---|---|
| [apache/ofbiz-framework](https://github.com/apache/ofbiz-framework) | Apache-2.0 | 2026-10-08 | `f4a6d19a0f` | R | M5 | Supply chain ERP framework |
| [frappe/erpnext](https://github.com/frappe/erpnext) | GPL-3.0 | 2026-10-08 | `0c2c35655a` | R | M5 | ERP procurement flows (copyleft: study only) |
| [inventree/InvenTree](https://github.com/inventree/InvenTree) | MIT | 2026-10-07 | `800cbe0d30` | R | M5 | Parts, suppliers, purchase orders: data model reference |
| [odoo/odoo](https://github.com/odoo/odoo) | LGPL (see repo) | 2026-10-08 | `3e1d217304` | R | M5 | ERP purchase flows (study only) |
| [openboxes/openboxes](https://github.com/openboxes/openboxes) | EPL | 2026-10-07 | `b477674a4a` | R | M6 | Supply chain/inventory app |
| [docusealco/docuseal](https://github.com/docusealco/docuseal) | AGPL-3.0 | 2026-10-05 | `c6a7555f54` | R | M8 | E-signature workflows (copyleft: study only) |

## Not found (dropped)

- `digiwhist/worker`: no repository at that path (renamed, moved or never existed). Tender data pipeline and corruption indicators (DIGIWHIST)
- `openepcis/openepcis-events-sdk`: no repository at that path (renamed, moved or never existed). GS1 EPCIS supply-chain event model

## Seen but not verified (services and non-GitHub sources)

- NCALayer desktop application and EDS documentation: pki.gov.kz (official source; terms and server-side validation options to confirm).
- AIS streaming services and port/terminal data vendors: evaluate in M6; not repos.
- Kazakhstan ISSAI language models and corpora: search showed none confirmed on GitHub in this run; check Hugging Face in M2.
- OpenSanctions data licence: code is open, data is commercial-licence for business use (see data-sources register).
