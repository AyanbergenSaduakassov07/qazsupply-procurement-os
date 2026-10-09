# infra/ci

CI is `.github/workflows/ci.yml` (GitHub requires that path). All jobs are required checks for `main`:

| Job | Runs |
|---|---|
| `lint` | Biome, ruff check + format |
| `typecheck` | tsc (all packages), mypy strict, api-client drift (`git diff --exit-code packages/api-client`) |
| `unit` | node:test suites, pytest (not contract / integration) |
| `contract` | connector contract + source register, `scripts/vendor.sh check` |
| `rls` | local Supabase: pgTAP, `scripts/advisors.sh` (splinter), pytest integration (API isolation on real auth) |
| `e2e` | production web build; Playwright functional (3 viewports), visual baselines in the Linux image, Lighthouse a11y >= 95 |
| `security-scan` | gitleaks (full history), OSV-Scanner (both lockfiles), CycloneDX SBOM |
| `license-scan` | `scripts/license_check.py` (allowlist + documented exceptions) |

**Branch protection:** the intended ruleset is `.github/rulesets/main.json` (PR required, required checks, no force-push or deletion). GitHub only enforces rulesets on private repos with a paid plan. After upgrading, apply it with:

```bash
gh api -X POST repos/AyanbergenSaduakassov07/QazSupply/rulesets --input .github/rulesets/main.json
```

Repo settings already applied: squash-merge only (title + body from the PR), delete branch on merge.

**Supply chain:** actions pinned to commit SHAs; Dependabot (`.github/dependabot.yml`) with a 14-day cooldown for npm, uv and actions.
