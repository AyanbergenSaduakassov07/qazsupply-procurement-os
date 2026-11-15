# services/evidence

Evidence: the link from any figure to its source rows and the computation that produced it.

**Public interface:** `services.evidence.api.get(conn, org_id, evidence_id) -> dict | None`. Wraps SQL `public.get_evidence(id)` (security invoker, so RLS applies): method, computation id, code version, inputs, result, source rows (file + row), linked findings and reviewer. Returns `None` for another tenant's id or for evidence behind an unreleased report (client roles).

**Rules:** no figure without Evidence (docs/glossary.md). Evidence rows are written by the analysis pipeline (service role) in M2.
