#!/usr/bin/env bash
# Lighthouse accessibility gate (>= 95) on key screens, signed in as the seeded client admin.
# Needs the stack running (Supabase, API :8000, web :3000). Uses Playwright's Chromium.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="${E2E_BASE_URL:-http://localhost:3000}"
MIN="${LIGHTHOUSE_MIN:-95}"
LIGHTHOUSE="lighthouse@13.5.0"
export CHROME_PATH
CHROME_PATH=$(cd e2e && node -e "console.log(require('@playwright/test').chromium.executablePath())")
KEY="${SUPABASE_PUBLISHABLE_KEY:-$(supabase status --workdir infra -o json 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin)["PUBLISHABLE_KEY"])')}"
TOKEN=$(python3 - "$KEY" <<'PY'
import json, sys, urllib.request
f = json.load(open("e2e/fixtures/users.json"))
req = urllib.request.Request(
    "http://127.0.0.1:54321/auth/v1/token?grant_type=password",
    data=json.dumps({"email": f["users"]["clientAdminA"], "password": f["password"]}).encode(),
    headers={"apikey": sys.argv[1], "Content-Type": "application/json"},
)
print(json.load(urllib.request.urlopen(req))["access_token"])
PY
)
OUT=$(mktemp -d)
HEADERS="$OUT/headers.json"
printf '{"Cookie":"qs_access_token=%s"}' "$TOKEN" > "$HEADERS"
fail=0
for path in /en/sign-in /ru/sign-in /kk/sign-in /en /ru /kk /en/audit /en/settings /en/gallery \
  /en/spend /kk/spend /en/spend/review /en/spend/reports \
  /en/spend/reports/40000000-0000-4000-a000-00000000000a \
  /kk/spend/reports/40000000-0000-4000-a000-00000000000a \
  /en/suppliers /kk/suppliers /en/suppliers/7a000000-0000-4000-a000-0000000000a1 \
  /kk/suppliers/7a000000-0000-4000-a000-0000000000a2 /en/onboarding /en/audit?kind=file \
  /en/rfqs /en/rfqs/new /en/rfqs/a5000000-0000-4000-a000-0000000000d1 \
  /kk/rfqs/a5000000-0000-4000-a000-0000000000d1/compare /en/catalogue; do
  extra=()
  [[ "$path" == */sign-in ]] || extra=(--extra-headers="$HEADERS")
  npx --yes "$LIGHTHOUSE" "$BASE$path" --only-categories=accessibility --output=json \
    --output-path="$OUT/report.json" --quiet ${extra[@]+"${extra[@]}"} \
    --chrome-flags="--headless=new --no-sandbox" >/dev/null
  score=$(python3 -c "import json;print(round(json.load(open('$OUT/report.json'))['categories']['accessibility']['score']*100))")
  echo "$score  $path"
  if (( score < MIN )); then
    fail=1
    python3 -c "
import json; r=json.load(open('$OUT/report.json'))
for a in r['audits'].values():
    if a.get('score') == 0 and a.get('scoreDisplayMode') == 'binary': print('   -', a['id'], a['title'])"
  fi
done
rm -rf "$OUT"
exit $fail
