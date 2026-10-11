#!/usr/bin/env bash
# One command for the full local demo: `pnpm demo` (or `make demo`).
#   --fresh  reset the local database to the seed first (removes your own demo changes)
#   --ai     answer Ask with the real free model (OPENROUTER_API_KEY in .env.local), not the
#            deterministic local stand-in. Free models have a daily cap.
# Starts Docker if needed, local Supabase, the API (:8000) and the web app (:3000, dev mode),
# loads the demo data, opens the browser. Ctrl+C stops the API and web; Supabase keeps running
# (`supabase --workdir infra stop` to stop it). Local synthetic data only.
set -euo pipefail
cd "$(dirname "$0")/.."

FRESH=0
PROVIDER=scripted
for arg in "$@"; do
  case "$arg" in
    --fresh) FRESH=1 ;;
    --ai) PROVIDER=openrouter ;;
    *) echo "unknown option: $arg (use --fresh, --ai)"; exit 2 ;;
  esac
done
SKIP=studio,imgproxy,inbucket,edge-runtime,logflare,vector,supavisor,realtime,storage-api,postgres-meta
step() { printf '\n\033[1m%s\033[0m\n' "$*"; }

step "1/5 Docker"
if ! docker info >/dev/null 2>&1; then
  if command -v orb >/dev/null; then orb start; else open -a Docker; fi
  for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done
fi
docker info >/dev/null 2>&1 || { echo "Docker is not running. Start OrbStack or Docker Desktop and retry."; exit 1; }

step "2/5 Dependencies and database"
[[ -d node_modules ]] || pnpm install --frozen-lockfile
uv sync --quiet
supabase --workdir infra status >/dev/null 2>&1 || supabase --workdir infra start -x "$SKIP"
if [[ $FRESH == 1 ]]; then supabase --workdir infra db reset; fi
for _ in $(seq 1 30); do curl -sf -o /dev/null http://127.0.0.1:54321/auth/v1/health && break; sleep 1; done
SUPABASE_PUBLISHABLE_KEY=$(supabase --workdir infra status -o json | python3 -c 'import sys,json;print(json.load(sys.stdin)["PUBLISHABLE_KEY"])')
export SUPABASE_PUBLISHABLE_KEY SUPABASE_URL=http://127.0.0.1:54321 LLM_PROVIDER=$PROVIDER

step "3/5 API and web"
for port in 3000 8000; do
  if lsof -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is busy (another dev server?). Stop it and retry:"
    lsof -iTCP:$port -sTCP:LISTEN | tail -n +2
    exit 1
  fi
done
mkdir -p .demo
uv run uvicorn services.gateway.app:app --port 8000 > .demo/api.log 2>&1 &
API_PID=$!
pnpm --filter @qazsupply/web dev > .demo/web.log 2>&1 &
WEB_PID=$!
stop() {
  echo; echo "Stopping API and web ..."
  pkill -P "$WEB_PID" 2>/dev/null || true
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
  # next dev runs as a grandchild; the ports were free at start, so their listeners are ours.
  for port in 3000 8000; do lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true; done
}
trap stop EXIT        # any exit, including a failed step: never leave servers behind
trap 'exit 0' INT TERM
for _ in $(seq 1 90); do
  curl -sf -o /dev/null http://localhost:8000/health && curl -sf -o /dev/null http://localhost:3000/en/sign-in && break
  sleep 1
done
curl -sf -o /dev/null http://localhost:3000/en/sign-in || { echo "Web did not start: see .demo/web.log"; exit 1; }

step "4/5 Demo data"
uv run python -m scripts.demo_seed

step "5/5 Ready: http://localhost:3000"
python3 - <<'EOF'
import json
u = json.load(open("e2e/fixtures/users.json"))
print(f"  Password for every demo user: {u['password']}   (local test users only)")
print(f"  Client (sees released reports, Ask):  {u['users']['clientAdminB']}")
print(f"  Reviewer (runs analysis, approves):   {u['users']['reviewer']}  -> Findings: a draft is waiting")
print(f"  Other roles: {u['users']['clientAdminA']} (Org A), {u['users']['clientUserA']}, {u['users']['qsAdmin']}")
EOF
echo "  Ask answers with: $LLM_PROVIDER$([[ $PROVIDER == scripted ]] && echo ' (deterministic stand-in; --ai for the real free model)')"
echo "  Logs: .demo/api.log, .demo/web.log.  Ctrl+C to stop."
open "http://localhost:3000/en/sign-in" 2>/dev/null || true
wait
