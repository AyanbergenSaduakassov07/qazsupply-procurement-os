<!-- Title: conventional commit, e.g. `feat(ingest): idempotent re-upload by file hash` -->

## What and why

## Spec / ticket


## How it was tested
<!-- Commands run and their result. Paste the summary line, not "tests pass". -->

## What was NOT verified
<!-- REQUIRED. Write "nothing" only if that is literally true. -->

## UNVERIFIED assumptions
<!-- REQUIRED. Data/API behaviour, legal facts, vendor claims you did not confirm on a primary source. -->

## Checklist
- [ ] Tests added or updated; CI green
- [ ] New tables have `org_id`, RLS and a pgTAP test; `get_advisors` clean
- [ ] No hard-coded user-facing strings (kk / ru / en catalogs updated)
- [ ] Every new figure has an Evidence id
- [ ] No secrets, client data or PII in code, fixtures, logs or evals
- [ ] `docs/glossary.md` / ADR updated if terms or decisions changed
- [ ] New data source recorded in `docs/compliance/data-sources.md` first
