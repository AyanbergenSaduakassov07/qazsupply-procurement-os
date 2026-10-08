# Data classification

Status: M0 (2026-10-08). Not legal advice. KZ Law "On Personal Data and their Protection" applies to personal data; localisation and consent details are UNVERIFIED pending counsel (see `docs/discovery/grill.md` #6).

| Class | Examples | Storage | Access | To LLM provider? | In logs / evals? |
|---|---|---|---|---|---|
| **Public** | ЕНС ТРУ codes, public procurement records, NBK FX rates, published sanctions lists | Cached with source, licence, fetched_at | All authenticated users | Yes | Yes |
| **Client-confidential** | Purchase lines, prices, supplier lists, offers, RFQs, shipments, landed costs, reports | Tenant-isolated (RLS), encrypted at rest | Members of that org; QazSupply reviewers via logged membership | Only redacted, minimal fields for the task; never full files | Never raw. Evals use synthetic or anonymised data with client consent |
| **Personal** | Contact names, emails, phones, IIN, beneficial owners, directors, drivers | Minimised; separate columns/tables for easier deletion | Need-to-know; access logged | Names only when the task needs them (e.g., screening explanation); IIN never | Never |
| **Regulated** | Financing, guarantee, insurance applications; tax documents (ЭСФ/СНТ); customs declarations | Partner-held where possible; explicit consent; encrypted | Named roles only; every access logged | No (until counsel approves) | Never |
| **Secrets** | API keys, carrier credentials, signing keys | Secret manager / encrypted per tenant | Services only | Never | Never (scanned) |

Labels live in the schema (column comments `class:<name>`) from M1 so tooling can enforce redaction and log filters.
