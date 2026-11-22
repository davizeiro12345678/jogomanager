#!/usr/bin/env bash
# Manual bounded comparison: one public page, a single concurrent task.
# Authenticated web app fuzzing requires an independent staging deployment.
set -euo pipefail
d=/opt/jm-security/wapiti
test -x "$d/venv/bin/wapiti"
install -d -m 0700 -o 1000 -g 1000 "$d/reports" "$d/session"
report="wapiti-public-$(date -u +%Y%m%dT%H%M%SZ).json"
docker run --rm --network bridge --user 1000:1000 --read-only \
  --cap-drop=ALL --security-opt=no-new-privileges \
  --cpus=1 --memory=1300m --pids-limit=120 \
  --tmpfs /tmp:rw,nosuid,nodev,size=128m \
  -e HOME=/work -v "$d:/work:rw" \
  python:3.13-slim@sha256:e48f59cdba69a3cbd9ed2cf0f348d90d45a8d350d98134cf1070bc106ee9ed90 \
  /work/venv/bin/wapiti -u https://jogomanager.com/ \
  --scope page -m xss,sql,wapp \
  --max-scan-time 100 --max-attack-time 70 \
  --tasks 1 -d 1 -t 7 -f json \
  -o "/work/reports/$report" --no-bugreport
chmod 0600 "$d/reports/$report"
echo "Private Wapiti report: $d/reports/$report"
