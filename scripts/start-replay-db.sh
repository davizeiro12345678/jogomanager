#!/usr/bin/env bash
# Disposable CI database only. Keep the pinned CLI and image version; retry
# official mirrors only for registry rate limits, never SQL or health failures.
set -uo pipefail
log=$(mktemp)
status=1
for registry in ghcr.io public.ecr.aws docker.io; do
  echo "Starting local database using $registry"
  if SUPABASE_INTERNAL_IMAGE_REGISTRY="$registry" supabase db start 2>&1 | tee "$log"; then
    # db reset must resolve the same cached image as the successful start.
    if [[ -n "${GITHUB_ENV:-}" ]]; then
      echo "SUPABASE_INTERNAL_IMAGE_REGISTRY=$registry" >> "$GITHUB_ENV"
    fi
    exit 0
  else
    status=$?
  fi
  if ! grep -Eiq 'toomanyrequests|rate.?limit|Data limit exceeded|429 Too Many Requests' "$log"; then
    exit "$status"
  fi
  echo "Registry rate limit; trying the next official mirror."
done
exit "$status"
