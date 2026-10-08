# infra/ci

CI lives in `.github/workflows/ci.yml` (GitHub requires that path). Jobs, all intended as **required checks** on `main`:
`lint`, `typecheck`, `unit`, `contract` (incl. `vendor.sh check`), `rls` (pgTAP on local Supabase), `e2e-smoke` (Playwright), `security-scan` (gitleaks on full history, OSV-Scanner on both lockfiles, Syft CycloneDX SBOM), `license-scan` (`scripts/license_check.py`).

Branch protection must be set in GitHub once a remote exists (not done in M0). Actions are pinned to commit SHAs.
