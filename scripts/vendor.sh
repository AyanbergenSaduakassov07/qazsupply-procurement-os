#!/usr/bin/env bash
# Thin wrapper: scripts/vendor.sh list | sync [slug...] | check
exec python3 "$(dirname "$0")/vendor.py" "$@"
