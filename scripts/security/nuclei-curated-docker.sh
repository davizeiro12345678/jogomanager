#!/usr/bin/env bash
# Complementary Nuclei check for public, read-only endpoints.
# Production-safe: six reviewed signed HTTP templates, 2 RPS, 1 concurrency.
# Does not certify absence of vulnerabilities and does not replace ZAP.
set -euo pipefail
umask 077
root="${NUCLEI_AUDIT_DIR:-/opt/jm-security/nuclei}"
if [ ! -d "$root/nuclei-templates/http" ]; then
  echo "nuclei-templates are not installed at $root" >&2
  exit 2
fi
install -d -m 0700 "$root/reports"
report="nuclei-$(date -u +%Y%m%dT%H%M%SZ).jsonl"
docker run --rm \
  --network bridge --cpus=1 --memory=1100m --pids-limit=130 \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  --tmpfs /tmp:rw,nosuid,size=128m --user 1000:1000 \
  -e HOME=/home/nuclei -e XDG_CONFIG_HOME=/home/nuclei/.config \
  -e XDG_CACHE_HOME=/home/nuclei/.cache \
  -v "$root:/home/nuclei:rw" \
  projectdiscovery/nuclei@sha256:582d5546902e67052097cb2d07296c642d50a1afc5e44623cb038845df9a32eb \
  -u https://jogomanager.com/ \
  -t /home/nuclei/nuclei-templates/http/misconfiguration/http-missing-security-headers.yaml \
  -t /home/nuclei/nuclei-templates/http/misconfiguration/weak-csp-detect.yaml \
  -t /home/nuclei/nuclei-templates/http/misconfiguration/csp-script-src-wildcard.yaml \
  -t /home/nuclei/nuclei-templates/http/vulnerabilities/generic/cors-misconfig.yaml \
  -t /home/nuclei/nuclei-templates/http/exposures/configs/git-config.yaml \
  -t /home/nuclei/nuclei-templates/http/miscellaneous/robots-txt.yaml \
  -ni -pt http -etags dos,fuzz,bruteforce,oast,headless \
  -rl 2 -c 1 -timeout 8 -retries 0 -mhe 5 -dut \
  -jsonl -o "/home/nuclei/reports/$report"
echo "Evidence: $root/reports/$report"
