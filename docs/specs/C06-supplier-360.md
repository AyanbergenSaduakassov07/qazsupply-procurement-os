# C06. Supplier 360 dossier and risk score

| Field | Value |
|---|---|
| User | Procurement manager, CFO / auditor |
| Phase | 2 (M4) |
| Dependencies | Connectors: goszakup (incl. РНУ unfair-supplier registry), egov, registries, opensanctions; C07; spend history (C03) |
| Regulatory flag | Personal data of owners/directors; defamation risk of risk labels; source licences |

**Job:** "Can I trust this supplier? Show me why, with sources and dates."

**Flow:** search by BIN or name -> dossier: verdict strip (trust level + top 3 reasons) -> tabs: ownership, legal/registry, sanctions, procurement history (public contracts, РНУ), performance (own spend + delivery), documents.

**Acceptance criteria**
1. Every flag has a source link + fetched date; stale data (> N days) visibly marked.
2. Risk score is rules-first with visible, org-editable weights; never presented as a credit rating.
3. AI summary labelled AI-generated, with citations.
4. Source-down / rate-limited / schema-drift each have a tested degraded state.
5. 20 real suppliers profiled for the gate; used in >= 5 real decisions.

**AI vs deterministic:** facts and score deterministic; summary by LLM with citations.

**Human gate:** none to view; any "do not buy" recommendation is a human decision recorded in the RFQ/decision record.

**Error states:** BIN not found; multiple matches by name; registry requires login (not automated: show "check manually" link).
