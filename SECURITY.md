# Security policy

## Reporting
Report vulnerabilities privately through GitHub: **Security -> Report a vulnerability** on this repository. Do not open public issues, and do not include client data in reports. Expect an acknowledgement within 3 working days.

## Scope and model
- Tenant isolation is enforced by Postgres row-level security; the API queries as the signed-in user. See `docs/adr/0002-postgres-rls-tenancy.md`.
- Threat model (STRIDE) and LLM risks: `docs/security/threat-model.md`, `docs/security/llm-risks.md`.
- Data classes and retention: `docs/compliance/data-classification.md`, `docs/compliance/retention-policy.md`.

## Rules for contributors
- No secrets in the repo: `.env.example` holds names only; gitleaks runs in pre-commit and CI on full history.
- No real client or personal data in code, fixtures, logs or evals.
- Remote migrations, deploys and anything that sends messages or moves money are human-approved (`docs/runbooks/agent-harness.md`).
- Leaked secret: rotate first, then purge history, then record it in `docs/security/incidents/`.
