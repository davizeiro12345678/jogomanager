#!/usr/bin/env bash
# JogoManager: weekly full filesystem baseline + daily GNU tar incrementals.
# DB consistency comes from the EXISTING jm-backup-daily pg_dump service.
# Not a replacement for encrypted off-site backups or a full VPS image.
set -Eeuo pipefail
umask 077
mode="${1:-}"
case "$mode" in preflight|weekly|daily|verify) ;; *) echo 'usage: jm-tiered-backup.sh {preflight|weekly|daily|verify}' >&2; exit 64;; esac
base="${JM_BACKUP_ROOT:-/root/jm-recovery}/tiered-files"
daily_source="${JM_BACKUP_ROOT:-/root/jm-recovery}/daily"
src="${JM_SOURCE_ROOT:-/}"
state="$base/state/tar.snar"

fail() { printf 'BACKUP_ERROR: %s\n' "$*" >&2; exit 1; }
[[ "${JM_TESTING:-0}" == 1 || "$(id -u)" == 0 ]] || fail 'root required'
if [[ "$mode" != preflight && "${JM_TESTING:-0}" != 1 ]]; then
  hour=$(TZ=America/Sao_Paulo date +%H)
  ((10#$hour >= 23 || 10#$hour < 3)) || fail 'outside approved 23:00-03:00 BRT window'
fi
for cmd in tar zstd sha256sum flock; do command -v "$cmd" >/dev/null || fail "$cmd missing"; done
latest_daily=''
if [[ -d "$daily_source" ]]; then
  latest_daily=$(find "$daily_source" -mindepth 1 -maxdepth 1 -type d -name 'daily-20*' -print | LC_ALL=C sort | tail -n 1)
fi
[[ -n "$latest_daily" && -s "$latest_daily/SHA256SUMS" ]] || fail 'verified daily PostgreSQL/config backup is required'
(cd "$latest_daily" && sha256sum -c SHA256SUMS >/dev/null) || fail 'existing database backup has invalid checksums'
if [[ "$mode" == preflight ]]; then
  printf 'PREFLIGHT_OK latest_daily=%s base=%s\n' "$(basename "$latest_daily")" "$base"
  exit 0
fi

install -d -m 0700 "$base" "$base/state" "$base/daily" "$base/weekly"
exec 9>"$base/.lock"
flock -n 9 || fail 'another tiered backup is running'
free_bytes=$(df -PB1 "$base" | awk 'NR==2{print $4}')
(( free_bytes > 20 * 1024 * 1024 * 1024 )) || fail 'less than 20 GiB free'
if [[ "$mode" == verify ]]; then
  latest_weekly=$(find "$base/weekly" -mindepth 1 -maxdepth 1 -type d -name '20*' -print | LC_ALL=C sort | tail -n 1)
  [[ -n "$latest_weekly" ]] || fail 'no weekly full baseline available'
  (cd "$latest_weekly" && sha256sum -c SHA256SUMS >/dev/null) || fail 'full archive checksum mismatch'
  (cd "$latest_weekly/postgresql-dumps" && sha256sum -c SHA256SUMS >/dev/null) || fail 'full backup PostgreSQL dumps checksum mismatch'
  zstd -q --test "$latest_weekly/archive.tar.zst" || fail 'compressed full archive corrupt'
  testdir=$(mktemp -d "$base/.restore-test.XXXXXXXX")
  trap 'rm -rf -- "$testdir"' EXIT
  if [[ -f "$src/etc/hostname" ]]; then
    mkdir -p "$testdir/restore"
    zstd -q -dc "$latest_weekly/archive.tar.zst" | tar -xf - -C "$testdir/restore" --no-same-owner --no-same-permissions etc/hostname
    [[ -s "$testdir/restore/etc/hostname" ]] || fail 'test restore of hostname failed'
  fi
  printf 'VERIFY_OK archive=%s\n' "$latest_weekly/archive.tar.zst"
  exit 0
fi
if [[ "$mode" == daily && ! -s "$state" ]]; then
  fail 'first run weekly baseline before daily incrementals'
fi
stamp=$(date -u +%Y%m%dT%H%M%SZ)
work=$(mktemp -d "$base/.partial-$mode-$stamp.XXXXXXXX")
trap 'rm -rf -- "$work"' EXIT
if [[ "$mode" == daily ]]; then cp -p "$state" "$work/tar.snar"; else : > "$work/tar.snar"; fi
sources=()
for candidate in etc srv/jogomanager opt/jm-ops opt/jogomanager-catalog opt/jm-catalog-static opt/jm-monitoring var/www; do
  [[ -e "${src%/}/$candidate" ]] && sources+=("$candidate")
done
(( ${#sources[@]} >= 1 )) || fail 'nothing exists to back up'
args=( -C "$src" "${sources[@]}" )
nice -n 12 ionice -c3 tar --create --file=- --listed-incremental="$work/tar.snar" \
  --one-file-system --numeric-owner --acls --xattrs \
  --exclude='*/node_modules' --exclude='*/.git/objects' --exclude='*/.cache' \
  "${args[@]}" | zstd -q -T2 -3 > "$work/archive.tar.zst"
if [[ "$mode" == weekly ]]; then
  cp -a -- "$latest_daily" "$work/postgresql-dumps"
  (cd "$work/postgresql-dumps" && sha256sum -c SHA256SUMS >/dev/null) || fail 'copied PostgreSQL dumps failed checksum validation'
fi
[[ -s "$work/archive.tar.zst" && -s "$work/tar.snar" ]] || fail 'archive or state file missing'
zstd -q --test "$work/archive.tar.zst" || fail 'compressed archive invalid'
( cd "$work" && sha256sum archive.tar.zst tar.snar > SHA256SUMS && sha256sum -c SHA256SUMS >/dev/null )
target="$base/$mode/$stamp"
mv -- "$work" "$target"
trap - EXIT
cp -- "$target/tar.snar" "$base/state/tar.snar.new"
chmod 0600 "$base/state/tar.snar.new"
mv -f -- "$base/state/tar.snar.new" "$state"
printf 'BACKUP_OK mode=%s archive=%s\n' "$mode" "$target/archive.tar.zst"
