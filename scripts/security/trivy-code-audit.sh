#!/usr/bin/env bash
# Scan only an isolated code copy (never live root, /etc, or database).
# Reports can contain secret indicators: keep them privately on the VPS.
set -euo pipefail
base=/opt/jm-security/trivy
src="$base/work/jogomanager-main"
if [ "$#" -gt 0 ]; then src="$1"; fi
src="$(realpath -e "$src")"
case "$src" in
  /opt/jm-security/trivy/work/*) ;;
  *) echo "Refusing path outside the isolated Trivy workspace" >&2; exit 2 ;;
esac
test -d "$src"
install -d -m 0700 -o 1000 -g 1000 "$base/cache" "$base/reports"
output="jogomanager-$(date -u +%Y%m%dT%H%M%SZ).json"
docker run --rm --network bridge --user 1000:1000 \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  --memory=4g --cpus=2 --pids-limit=200 \
  --tmpfs /tmp:rw,nosuid,nodev,size=512m \
  -e TMPDIR=/tmp -e TRIVY_CACHE_DIR=/home/trivy/cache \
  -v "$base/cache:/home/trivy/cache:rw" \
  -v "$base/reports:/reports:rw" -v "$src:/scan:ro" \
  aquasec/trivy@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb \
  fs --scanners vuln,misconfig,secret --format json \
  --output "/reports/$output" --timeout 12m /scan
chmod 0600 "$base/reports/$output"
echo "Private Trivy report: $base/reports/$output"
