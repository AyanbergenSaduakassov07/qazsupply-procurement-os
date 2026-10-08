#!/usr/bin/env bash
# Run Supabase's advisor lints (splinter, the rules behind get_advisors) against the LOCAL db.
# Fails on any WARN/ERROR; INFO "unused_index" is expected on an empty database.
# splinter.sql pinned from supabase/splinter@fccca4b1c4d8b48b8ccd69bd6b30e84adcb92975 (Apache-2.0).
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${SUPABASE_DB_CONTAINER:-supabase_db_qazsupply}"
out=$( { echo "begin read only;"; cat scripts/sql/splinter.sql; printf ';\nrollback;\n'; } \
  | docker exec -i "$DB" psql -U postgres -d postgres -q -A -F '|' -t -v ON_ERROR_STOP=1 )
echo "$out" | awk -F'|' 'NF>3 {print $3"\t"$1"\t"$7}' | grep -v "^INFO	unused_index" || true
if echo "$out" | awk -F'|' 'NF>3 {print $3}' | grep -qE '^(WARN|ERROR)$'; then exit 1; fi
if echo "$out" | awk -F'|' 'NF>3 && $1!="unused_index"' | grep -q .; then exit 1; fi
echo "advisors: clean"
