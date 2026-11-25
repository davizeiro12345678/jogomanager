#!/usr/bin/env bash
# Read-only Linux VPS malware / persistence investigation.
# Do not confuse suspicious process names or scan hits with confirmed infection.
set -Eeuo pipefail
umask 077
export LC_ALL=C
if (( $# != 1 )); then echo 'Usage: security-audit.sh core8|plus6' >&2; exit 2; fi
label=$1
case "$label" in
  core8) expected_ip=194.163.188.190 ;;
  plus6) expected_ip=144.91.111.116 ;;
  *) echo 'Unknown target' >&2; exit 2 ;;
esac
if grep -qiE 'microsoft|wsl' /proc/sys/kernel/osrelease; then echo 'WSL refused' >&2; exit 3; fi
command -v ip >/dev/null || { echo 'iproute2 required' >&2; exit 3; }
ip -o -4 addr show scope global | grep -Fq "$expected_ip/" || { echo 'IP mismatch; refusing audit' >&2; exit 3; }
out="$(pwd -P)/results/$label/$(date -u +%Y%m%dT%H%M%SZ)-security"
mkdir -p "$out"
chmod 700 "$out"
date -u +%Y-%m-%dT%H:%M:%SZ > "$out/start_utc"
printf '%s\n' "$label" > "$out/target"
: > "$out/skipped.tsv"
probe() {
  local key=$1
  shift
  if command -v "$1" >/dev/null 2>&1; then
    timeout 35s "$@" > "$out/$key.txt" 2>&1 ||
      printf '%s\tfailure_or_timeout\n' "$key" >> "$out/skipped.tsv"
  else
    printf '%s\tmissing_tool\n' "$key" >> "$out/skipped.tsv"
  fi
}
probe 01_kernel uname -a
probe 02_identity id
probe 03_packages dpkg-query -W
probe 04_processes ps -eo pid,ppid,uid,etimes,pcpu,pmem,comm --sort=-pcpu
probe 05_listeners ss -ltnup
probe 06_connections ss -tnup
probe 07_enabled_services systemctl list-unit-files --type=service --state=enabled --no-pager
probe 08_timers systemctl list-timers --all --no-pager
probe 09_recent_logins last -n 30
probe 10_failed_logins lastb -n 30
probe 11_tmp_executables find /tmp /var/tmp /dev/shm -xdev -maxdepth 5 -type f -perm /111 -printf '%p\t%u\t%m\t%TY-%Tm-%TdT%TH:%TM\n'
probe 12_mounts findmnt -r
probe 13_root_crontab crontab -u root -l
probe 14_firewall nft list ruleset
probe 15_ssh_service systemctl is-active ssh.service
# These signatures are triage hints; no deletion based solely on a name.
grep -Ei '(xmrig|kinsing|kdevtmpfsi|cryptominer|minerd)' "$out/04_processes.txt" > "$out/name_matches_not_confirmed.txt" || true
# Full on-host AV scan is opt-in because it can consume considerable resources.
if env | grep -qx 'JM_SECURITY_FULL_SCAN_APPROVED=1'; then
  if command -v clamscan >/dev/null 2>&1; then
    timeout 1800s nice -n 15 clamscan --recursive --infected --no-summary /opt /var/www /tmp /var/tmp \
      > "$out/clamav.txt" 2>&1 ||
      printf 'clamscan\tfindings_or_error_or_timeout\n' >> "$out/skipped.tsv"
  else
    printf 'clamscan\tmissing_tool\n' >> "$out/skipped.tsv"
  fi
fi
date -u +%Y-%m-%dT%H:%M:%SZ > "$out/end_utc"
echo "REPORT=$out"
echo 'Read-only: no process killed, no file quarantined, no file deleted. Raw reports are private.'
