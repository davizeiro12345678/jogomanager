#!/usr/bin/env bash
# JogoManager | READ-ONLY per-VPS Cloudflare/Supabase readiness probes.
# Uses public HTTPS endpoints ONLY. Does not read tokens, keys, .env or passwords.
set -Eeuo pipefail
umask 077
export LC_ALL=C
if (( $# != 1 )); then echo 'Usage: bash ops/vps/supabase-cloudflare-preflight.sh core8|plus6' >&2; exit 2; fi
label="$1"
case "$label" in core8) expected=194.163.188.190;; plus6) expected=144.91.111.116;; *) exit 2;; esac
if grep -qiE 'microsoft|wsl' /proc/sys/kernel/osrelease; then echo 'Refusing Windows/WSL'; exit 3; fi
command -v ip >/dev/null && ip -o -4 addr show scope global | grep -Fq "$expected/" || { echo 'Target VPS identity not verified'; exit 3; }
command -v curl >/dev/null || { echo 'curl missing'; exit 3; }
base="$(pwd -P)/results/$label/$(date -u +%Y%m%dT%H%M%SZ)-integration"
mkdir -p "$base"; chmod 0700 "$base"
date -u +%Y-%m-%dT%H:%M:%SZ > "$base/start_utc"
printf 'target=%s\n' "$label" > "$base/metadata.txt"
printf 'source_region=VPS Frankfurt or actual installed region; verify with hosting panel\n' >> "$base/metadata.txt"
printf 'supabase_project_region=us-west-2 (observed 2026-11-06)\n' >> "$base/metadata.txt"
{
  echo 'hostname target resolution:'
  getent ahostsv4 jogomanager.com || true
  getent ahostsv4 catalog.jogomanager.com || true
  getent ahostsv4 lguqnwvsfeefxamzeyos.supabase.co || true
} > "$base/dns.txt" 2>&1
printf 'endpoint\thttp_code\tdns_seconds\tconnect_seconds\ttls_seconds\tttfb_seconds\ttotal_seconds\n' > "$base/https.tsv"
probe() {
  local name="$1" url="$2" metrics
  metrics=$(timeout 16s curl --proto '=https' --tlsv1.2 --silent --show-error --output /dev/null --max-time 13 \
    --write-out '%{http_code}\t%{time_namelookup}\t%{time_connect}\t%{time_appconnect}\t%{time_starttransfer}\t%{time_total}' "$url" 2>"$base/curl_$name.err") || metrics='ERROR\tNA\tNA\tNA\tNA\tNA'
  printf '%s\t%s\n' "$name" "$metrics" >> "$base/https.tsv"
}
for attempt in 1 2 3; do
  probe "supabase_auth_health_$attempt" 'https://lguqnwvsfeefxamzeyos.supabase.co/auth/v1/health'
  probe "cloudflare_catalog_$attempt" 'https://catalog.jogomanager.com/v1/public/clubs?limit=1&page=0'
done
for s in ssh nginx cloudflared docker; do
  if command -v systemctl >/dev/null 2>&1; then
    systemctl is-active "$s.service" > "$base/service_$s.txt" 2>&1 || true
  fi
done
if command -v ss >/dev/null 2>&1; then
  ss -ltn > "$base/listening_tcp.txt" 2>&1 || true
fi
curl --silent --output /dev/null --max-time 4 --write-out '%{http_code}\t%{time_total}\n' \
  'http://127.0.0.1:3092/healthz' > "$base/local_catalog_health.txt" 2>&1 || true
date -u +%Y-%m-%dT%H:%M:%SZ > "$base/end_utc"
echo "REPORT=$base"
echo 'Read-only: no credentials used; no DNS, service or database settings changed.'
