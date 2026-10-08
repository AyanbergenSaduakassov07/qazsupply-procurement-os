# ER diagram (M1 schema)

Source: `infra/supabase/migrations/20261008010000_m1_domain.sql`. Every arrow between client-data
tables is a composite `(x_id, org_id)` foreign key, so a row can never point at another tenant's row.

```mermaid
erDiagram
  organizations ||--o{ memberships : has
  organizations ||--o{ files : owns
  organizations ||--o{ audit_log : records
  organizations ||--o{ llm_calls : meters
  files ||--o{ purchase_lines : "source rows"
  suppliers ||--o{ purchase_lines : "resolved to"
  items ||--o{ purchase_lines : "matched to"
  suppliers ||--o{ suppliers : "merged_into"
  reports ||--o{ findings : contains
  reports ||--o{ reviews : "reviewed by"
  findings ||--o{ reviews : "reviewed by"
  findings ||--o{ finding_evidence : cites
  evidence ||--o{ finding_evidence : "cited by"
  evidence ||--o{ evidence_sources : "computed from"
  purchase_lines ||--o{ evidence_sources : "used in"
  shipments ||--o{ legs : "ordered legs"
  shipments ||--o{ shipment_events : "append-only facts"
  shipments ||--o{ documents : has
  files ||--o{ documents : "stored as"

  organizations { uuid id PK; text name; numeric llm_monthly_budget_usd }
  memberships { uuid org_id PK; uuid user_id PK; app_role role }
  files { uuid id PK; uuid org_id; text sha256 "unique per org"; uuid uploaded_by }
  purchase_lines { uuid id PK; uuid org_id; uuid file_id; int source_row; jsonb raw; numeric unit_price; char currency }
  suppliers { uuid id PK; uuid org_id; text name; text bin "12 digits" }
  items { uuid id PK; uuid org_id; text enstru_code; text name }
  reports { uuid id PK; uuid org_id; report_status status; int version; uuid released_by }
  findings { uuid id PK; uuid org_id; uuid report_id; finding_type type; numeric saving_estimate; numeric confidence }
  evidence { uuid id PK; uuid org_id; text computation_id; text method; text code_version; numeric result }
  evidence_sources { uuid evidence_id PK; uuid purchase_line_id PK; uuid org_id }
  finding_evidence { uuid finding_id PK; uuid evidence_id PK; uuid org_id }
  reviews { uuid id PK; uuid org_id; uuid report_id; uuid finding_id; uuid reviewer_id; review_decision decision }
  audit_log { bigint id PK; uuid org_id; uuid actor_id; text action; text prev_hash; text hash }
  llm_calls { uuid id PK; uuid org_id; text prompt_version; text prompt_sha256; text model; numeric cost_usd; bool redacted; text status }
  shipments { uuid id PK; uuid org_id; text reference }
  legs { uuid id PK; uuid org_id; uuid shipment_id; int seq; leg_mode mode }
  shipment_events { uuid id PK; uuid org_id; uuid shipment_id; text source; text source_event_id; numeric confidence }
  documents { uuid id PK; uuid org_id; uuid shipment_id; uuid file_id; text type; int version }
  border_nodes { uuid id PK; text code; char country }
```

Append-only (trigger rejects UPDATE/DELETE even for the owner): `audit_log`, `shipment_events`, `reviews`.
Hash chain: `audit_log.hash = sha256(prev_hash | row fields)`, verified by `private.verify_audit_chain(org)`.
