#!/usr/bin/env bash
set -u
# Read-only. Run locally on each VPS through verified VNC or SSH.
# Distribution security backports may retain an older upstream PHP version.
echo "=== OS and PHP ==="
date -u -Is
uname -srmo
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  printf 'OS: %s\n' "$PRETTY_NAME"
fi
if command -v php >/dev/null 2>&1; then php -v; else echo "No PHP binary in PATH"; fi
echo "=== Installed PHP packages ==="
if command -v dpkg-query >/dev/null 2>&1; then
  dpkg-query -W 'php*' 2>/dev/null || true
fi
echo "=== PHP-FPM units ==="
if command -v systemctl >/dev/null 2>&1; then
  systemctl list-unit-files --no-legend 'php*-fpm.service' --no-pager || true
fi
echo "=== Running container images ==="
if command -v docker >/dev/null 2>&1; then
  docker ps --format '{{.Image}} {{.Names}}' || true
else
  echo "Docker unavailable; check other container runtimes separately."
fi
echo "=== APT installed and candidate versions ==="
if command -v apt-cache >/dev/null 2>&1; then
  apt-cache policy php php8.1 php8.2 php8.3 php8.4 2>/dev/null || true
fi
echo "No changes made. Verify Ubuntu Security Notices and PHP image provenance before updating."
