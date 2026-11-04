#!/usr/bin/env bash
# Read-only catalog readiness; no changes to SSH, Cloudflare or app config.
set -u
printf 'UTC='
date -u +%Y-%m-%dT%H:%M:%SZ
printf 'HOST='
hostname
for p in cloudflared nginx curl sshd; do
  command -v "$p" >/dev/null 2>&1 && echo "$p=installed" || echo "$p=missing"
done
for svc in ssh nginx cloudflared docker; do
  if command -v systemctl >/dev/null 2>&1; then
    printf 'SERVICE_%s=' "$svc"
    systemctl is-active "$svc.service" 2>/dev/null || true
  fi
done
if command -v ss >/dev/null 2>&1; then
  ss -ltn | grep -Eq '127[.]0[.]0[.]1:3092[[:space:]]' && echo LOCAL_3092=LISTENING || echo LOCAL_3092=UNCONFIRMED
fi
if command -v curl >/dev/null 2>&1; then
  status=$(curl --silent --max-time 4 --output /dev/null --write-out '%{http_code}' 'http://127.0.0.1:3092/healthz') || status=unreachable
  echo "LOCAL_HEALTH=$status"
fi
if command -v timedatectl >/dev/null 2>&1; then
  timedatectl show -p NTPSynchronized 2>/dev/null || true
fi
echo READ_ONLY=TRUE
