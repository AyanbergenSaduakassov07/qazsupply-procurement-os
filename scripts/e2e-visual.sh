#!/usr/bin/env bash
# Render or compare visual baselines in the Linux Playwright image (same pixels as CI).
# Needs running: local Supabase, API on :8000, and a PRODUCTION web build on :3000
# (`pnpm --filter @qazsupply/web build && pnpm --filter @qazsupply/web start`).
# Usage: scripts/e2e-visual.sh [--update-snapshots] [extra playwright args]
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE="mcr.microsoft.com/playwright:v1.63.0-noble"  # keep in step with @playwright/test
if [[ "$(uname)" == "Linux" ]]; then
  net=(--network host); base="${E2E_BASE_URL:-http://localhost:3000}"
else
  net=(--add-host=host.docker.internal:host-gateway); base="${E2E_BASE_URL:-http://host.docker.internal:3000}"
fi
docker run --rm "${net[@]}" -e E2E_BASE_URL="$base" -e E2E_VISUAL=1 -e CI="${CI:-}" \
  -v "$PWD:$PWD" -w "$PWD/e2e" "$IMAGE" \
  npx playwright test tests/visual.spec.ts tests/auth.setup.ts "$@"
