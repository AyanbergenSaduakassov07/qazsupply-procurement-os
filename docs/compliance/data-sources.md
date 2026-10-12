# Data sources register

Every external source is recorded here BEFORE a connector is written. The `id` column must equal the connector folder name (`connectors/<id>/`); `connectors/_contract/test_contract.py` fails CI otherwise.

**Status:** `VERIFIED` = licence/terms read on the operator's own page and quoted below. `PARTIAL` = access method confirmed on a primary source, licence or limits not. `UNVERIFIED` = not confirmed on a primary source. Researched 2026-10-08 (M0). Nothing here is legal advice; rows marked Legal risk >= Medium need counsel before production use.

| id | Source | What we need | Access method | Licence / terms | Cost | Rate limits | Legal risk | Status |
|---|---|---|---|---|---|---|---|---|
| `enstru` | ЕНС ТРУ (classifier of goods, works, services; operated by ТОО «Самрук-Казына Контракт», used in all regulated procurement) | Codes + names (ru/kk), hierarchy, units | No official bulk download or API found (re-checked 2026-10-09). **Access path found:** goszakup OWS v3 `Lots` objects carry `enstruList` ("Список ИД ЕНС ТРУ") next to `nameRu`/`nameKz` (schema: https://ows.goszakup.gov.kz/help/v3/schema/lots.doc.html), so code-name pairs can be derived from public lots once we hold an OWS token. M2 uses a **synthetic sample** (`connectors/enstru/fixtures/`, codes prefixed `SYN-`, UI badge "sample data") | Unknown | Unknown | Unknown | Medium until terms found | UNVERIFIED (sample in use) |
| `goszakup` | goszakup.gov.kz OWS v3 (public procurement) | Plans, announcements, lots, contracts, participant registry, unfair-supplier registry (РНУ) | REST + GraphQL at `https://ows.goszakup.gov.kz/v3/...`; `Authorization: Bearer <token>`. Primary token issued on request by АО «Центр электронных финансов» (template letter); valid 1 year; renewed in the participant cabinet by an "Администратор организации" | Described by operator as "унифицированные сервисы (открытые данные)"; no written licence found | No fee mentioned | Not stated | Low-Medium: token is tied to a registered organization; confirm we may use it for third-party analytics | PARTIAL |
| `egov` | data.egov.kz (Open Data portal) | Registries and reference datasets | REST `https://data.egov.kz/api/v4/<dataset>/<version>?apiKey=...`; key from the developer cabinet (`/profile/apikeylist`) | Portal FAQ frames data as reusable "without restrictions imposed by copyright"; per-dataset terms may differ; formal licence text not located | Free | Not stated | Low (check each dataset) | PARTIAL |
| `registries` | Company registries: stat.gov.kz (Bureau of National Statistics) BIN lookup; egov.kz service "Сведения о зарегистрированном юридическом лице" | Legal entity, status, OKED, founders | stat.gov.kz cabinet search requires login; egov service requires ЭЦП/OTP per request. No open API found | Unknown | Unknown | Unknown | High if automated behind login: **do not scrape**. Needs official access agreement or a licensed reseller | UNVERIFIED |
| `opensanctions` | OpenSanctions (sanctions + PEP) | Screening of Parties | (a) Hosted Screening API, billed per query, prepaid credit bundles, free sign-up credits; (b) flat-rate internal "Screening license" for bulk data; (c) reseller licence | Bulk data CC BY-NC 4.0. Operator states: "Compliance screening is a commercial use even though it generates no revenue." -> **we need a paid licence**; reseller licence if clients see the data | Quote only (no public price) | Not stated | Medium (licence scope: internal vs reseller) | VERIFIED (licence model); price UNVERIFIED |
| `dualuse` | Dual-use / export-control lists (EAEU and Kazakhstan export control list; EU Regulation 2021/821 Annex I as reference) | Screening of Items (goods) | Legal texts (adilet.zan.kz, eur-lex.europa.eu); no API. Must be encoded by hand as dated data with HS/ЕНС ТРУ mapping. M4 uses a **synthetic keyword sample** (`connectors/dualuse/fixtures/`, ids `SAMPLE-DU-*`, labelled "not a legal control list") | Legal text, public | Free | n/a | High: a wrong mapping misses controlled goods; needs a customs/export-control specialist | UNVERIFIED (sample in use) |
| `fx` | National Bank of Kazakhstan official rates | Dated KZT rates for every purchase date | Historical XML per day: `https://nationalbank.kz/rss/get_rates.cfm?fdate=DD.MM.YYYY` (verified 2026-10-09: returns the full table for past dates; KZT per unit = description / quant). Snapshots cached per date with sha256 (`connectors/fx`) | Not stated on the feed | Free | Not stated | Low | PARTIAL (access verified, licence not stated) |
| `customs` | EAEU Customs Code (ТК ЕАЭС) + КГД (State Revenue Committee) | Document requirements (art. 108: transaction docs, transport docs, customs value docs, procedure docs), duty/VAT rules as dated data | Legal text (eec.eaeunion.org / adilet). No API. Rules encoded by hand as data with source + effective date | Legal text, public | Free | n/a | Medium: misreading law; needs broker/lawyer review | PARTIAL (art. 108 summary from secondary sources) |
| `carriers` | Forwarder / trucking APIs; e-invoicing ИС ЭСФ (esf.gov.kz, КГД) for invoice/СНТ cross-checks | Shipment events; invoice and СНТ (accompanying goods note) data | Per provider. ИС ЭСФ: КГД SDK (SOAP), test stand `test1.esf.kgd.gov.kz:8443`, GOST 34.10-2015 auth since 2023-11 | ИС ЭСФ access is per taxpayer with their ЭЦП: only with client's consent and credentials | Free (ИС ЭСФ) | Unknown | High (client credentials, tax data) | UNVERIFIED |
| `rail` | KTZ / KTZ Express (incl. Tez Customs), Middle Corridor (TITR association operators) | Wagon / container status | No public API found; tracking offered to customers. Partnership needed | Unknown | Unknown | Unknown | Medium | UNVERIFIED |
| `ais` | AIS vessel positions (Caspian, Black Sea, ocean legs) | Vessel positions for sea legs | Candidate: aisstream.io WebSocket, free key via GitHub login, server-side only, 3 connections/IP | Commercial use not stated on landing page; terms page not read | Free | 3 conn/IP, 3 subs/account; drops slow readers | Low-Medium (terms) | UNVERIFIED |
| `news` | News, official notices, customs/tax announcements, border advisories (КГД, CarGoRuqsat e-queue) | Risk Radar input | RSS / official sites; no queue-length API found for CarGoRuqsat | Per publisher | Mostly free | n/a | Medium (copyright: store links + short facts, not full text) | UNVERIFIED |
| `banks` | Banks / insurers | Financing and cover quotes | Partner sandbox (M8) | Contract | Contract | Contract | High (regulated; legal advice first) | UNVERIFIED |

## M4 re-check (2026-10-12)
- OpenSanctions licensing page re-read: bulk data CC BY-NC 4.0; business options are the hosted Screening API (per query), a flat-rate Screening licence and a Reseller/OEM licence; prices by quote only. Unchanged from M0. M4 runs on invented entities (`connectors/opensanctions`, ids `SAMPLE-*`).
- goszakup (no OWS token yet), data.egov.kz (no key) and company registries (no open API) were not reachable for us: M4 uses sample adapters `connectors/goszakup` (РНУ only) and `connectors/registries`, badged "sample data" in the UI. `egov` has no M4 adapter (no dataset needed yet).
- Failure modes (down, rate limited, schema drift) are typed in `connectors/outage.py` and shown as degraded states.

## Primary sources consulted
- goszakup OWS v3 developer page: https://old.goszakup.gov.kz/ru/developer/ows_v3 ; schema https://ows.goszakup.gov.kz/help/v3/schema/
- data.egov.kz API samples and FAQ: https://data.egov.kz/pages/samples , https://data.egov.kz/pages/faq
- OpenSanctions licensing: https://www.opensanctions.org/licensing/ ; exemptions: https://www.opensanctions.org/docs/commercial/exemption/
- National Bank RSS: https://nationalbank.kz/rss/rates_all.xml
- КГД ИС ЭСФ API page (SDK): https://kgd.gov.kz/ru/content/api-interfeys-web-prilozheniya-elektronnye-scheta-faktury-1 (link found via search, not opened)
- aisstream.io: https://aisstream.io/
- TITR: https://middlecorridor.com ; KTZ Express: https://ktze.kz/en
- ЕНС ТРУ operator info: https://www.skc.kz/activity/ens-tru/ (via search; not opened)

## Next actions (owner)
1. Write to АО «ЦЭФ» (support@ecc.kz per a third-party repo; UNVERIFIED) for an OWS v3 token and ask in writing whether commercial analytics use is permitted.
2. Ask ТОО «Самрук-Казына Контракт» for ЕНС ТРУ bulk access and terms.
3. Get an OpenSanctions quote for an internal screening licence + reseller scope.
4. Ask КТЖ / KTZ Express about tracking API access for clients' containers.

Rules: legal and open sources only; no scraping behind logins; record `fetched_at` and licence with every cached record (`SourceRecord` in `connectors/_contract`).
