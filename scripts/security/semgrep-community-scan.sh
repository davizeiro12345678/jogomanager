#!/usr/bin/env bash
# Fifth free tool: Semgrep CE. Only scan an isolated checkout, never live
# credentials/volumes. JSON may include source code and stays on the VPS.
set -euo pipefail
base=/opt/jm-security/semgrep
repo=/opt/jm-security/trivy/work/jogomanager-pr144
test -d "$repo/.git"
install -d -m 0700 -o 1000 -g 1000 "$base/reports"
name="semgrep-$(date -u +%Y%m%dT%H%M%SZ).json"
docker run --rm --network bridge --user 1000:1000 \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  --cpus=2 --memory=3g --pids-limit=200 \
  --tmpfs /tmp:rw,nosuid,nodev,size=512m \
  -e HOME=/tmp -e SEMGREP_SEND_METRICS=off \
  -v "$repo:/src:ro" -v "$base/reports:/reports:rw" \
  semgrep/semgrep@sha256:6e1b04340e60e910fbb4ddbf3c857ab0918f064417ad5ac530014ccb3cf8c8f1 \
  semgrep scan --config p/owasp-top-ten --json \
  --output "/reports/$name" --timeout 12 --max-memory 2000 /src
chmod 0600 "$base/reports/$name"
echo "Semgrep CE report: $base/reports/$name"
