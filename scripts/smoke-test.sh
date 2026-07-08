#!/usr/bin/env bash
# Post-deploy liveness check for PHENYX.
# Usage: ./scripts/smoke-test.sh <backend-url> [frontend-url]
# Example: ./scripts/smoke-test.sh https://api.staging.phenyxcollective.com https://staging.phenyxcollective.com
set -uo pipefail

BACKEND="${1:-}"
FRONTEND="${2:-}"

if [ -z "$BACKEND" ]; then
  echo "usage: $0 <backend-url> [frontend-url]" >&2
  exit 2
fi

fail=0

check() {
  local label="$1" url="$2" expect="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url" 2>/dev/null)
  if [ "$code" = "$expect" ]; then
    printf '  ✅ %-28s %s (%s)\n' "$label" "$code" "$url"
  else
    printf '  ❌ %-28s %s, expected %s (%s)\n' "$label" "$code" "$expect" "$url"
    fail=1
  fi
}

echo "== backend =="
check "health"            "$BACKEND/health" 200
# Authed routes should reject anonymous callers (401/403), proving the guard is wired.
check "constellation (auth gate)" "$BACKEND/constellation" 401
check "profile (auth gate)"       "$BACKEND/profile/overview" 401

if [ -n "$FRONTEND" ]; then
  echo "== frontend =="
  check "home" "$FRONTEND/" 200
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "smoke test PASSED — liveness ok. Now walk the manual flow in DEPLOYMENT.md (signup OTP → synthesis → dashboard → checkout)."
else
  echo "smoke test FAILED — see ❌ above. Common causes: migrations not applied, env vars missing, or CORS/API base URL mismatch."
  exit 1
fi
