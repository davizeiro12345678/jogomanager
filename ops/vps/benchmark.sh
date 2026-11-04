#!/usr/bin/env bash
# JogoManager VPS: bounded, unprivileged, non-destructive baseline.
set -Eeuo pipefail
umask 077
export LC_ALL=C
if (( $# != 2 )); then echo 'Usage: benchmark.sh core8|plus6 before|after' >&2; exit 2; fi
LABEL="$1"
PHASE="$2"
case "$LABEL" in core8) EXPECT=194.163.188.190;; plus6) EXPECT=144.91.111.116;; *) exit 2;; esac
case "$PHASE" in before|after) ;; *) exit 2;; esac
if (( EUID == 0 )); then echo 'Run as an unprivileged account' >&2; exit 3; fi
if grep -qiE 'microsoft|wsl' /proc/sys/kernel/osrelease; then echo 'WSL is not a VPS' >&2; exit 3; fi
command -v ip >/dev/null || { echo 'Missing iproute2' >&2; exit 3; }
ip -o -4 address show scope global | grep -Fq "$EXPECT/" || { echo 'Target IP mismatch' >&2; exit 3; }
OUT="$(pwd -P)/results/$LABEL/$(date -u +%Y%m%dT%H%M%SZ)-$PHASE"
mkdir -p "$OUT"
chmod 0700 "$OUT"
printf '%s\n' "$LABEL" > "$OUT/target"
printf '%s\n' "$PHASE" > "$OUT/phase"
date -u +%Y-%m-%dT%H:%M:%SZ > "$OUT/start_utc"
: > "$OUT/skipped.tsv"
probe() { local key="$1"; shift; timeout 12s "$@" > "$OUT/$key.txt" 2>&1 || printf '%s\tfailure_or_missing\n' "$key" >> "$OUT/skipped.tsv"; }
probe 01_kernel uname -a
probe 02_cpu lscpu
probe 03_ram free -b
probe 04_load uptime
probe 05_block lsblk -b -o NAME,TYPE,SIZE,ROTA,MODEL,MOUNTPOINTS
probe 06_fs df -B1 -T
probe 07_mount findmnt -r -o TARGET,SOURCE,FSTYPE
probe 08_interfaces ip -brief address
probe 09_routes ip -4 route show
probe 10_sockets ss -s
probe 11_processes ps -eo pid,comm,%cpu,%mem --sort=-%cpu
probe 12_cgroups cat /proc/self/cgroup
probe 13_cpu_stat cat /proc/stat
probe 14_meminfo cat /proc/meminfo
probe 15_diskstats cat /proc/diskstats
probe 16_psi_cpu cat /proc/pressure/cpu
probe 16_psi_ram cat /proc/pressure/memory
probe 16_psi_disk cat /proc/pressure/io
probe 17_dns getent ahostsv4 jogomanager.com
probe 18_ssh ssh -V
if command -v timedatectl >/dev/null 2>&1; then probe 19_ntp timedatectl show -p NTPSynchronized; fi
for svc in ssh nginx cloudflared docker; do
  if command -v systemctl >/dev/null 2>&1; then probe "20_service_$svc" systemctl is-active "$svc.service"; fi
done
if command -v sysbench >/dev/null 2>&1; then
  for threads in 1 2; do
    timeout 11s nice -n 15 sysbench cpu --threads="$threads" --time=6 --events=0 run > "$OUT/cpu_$threads.txt" 2>&1 || printf 'cpu_%s\tfailure\n' "$threads" >> "$OUT/skipped.tsv"
  done
  timeout 12s nice -n 15 sysbench memory --threads=1 --time=5 --memory-total-size=256M run > "$OUT/ram_speed.txt" 2>&1 || printf 'ram_speed\tfailure\n' >> "$OUT/skipped.tsv"
else printf 'sysbench\tmissing\n' >> "$OUT/skipped.tsv"; fi
if command -v fio >/dev/null 2>&1 && (( $(df -Pm "$OUT" | awk 'END{print $4+0}') >= 512 )); then
  SCRATCH=$(mktemp -d "$OUT/fio.XXXXXXXX")
  trap 'rm -rf -- "$SCRATCH"' EXIT
  timeout 13s nice -n 15 fio --name=bounded-seq-write --filename="$SCRATCH/data" --size=64m --rw=write --bs=1m --direct=1 --ioengine=sync --iodepth=1 --runtime=4 --time_based=1 --output-format=json --output="$OUT/fio_write.json" >/dev/null 2>&1 || printf 'fio_write\tfailure\n' >> "$OUT/skipped.tsv"
  if [[ -s "$SCRATCH/data" ]]; then
    timeout 13s nice -n 15 fio --name=bounded-rand-read --filename="$SCRATCH/data" --size=64m --rw=randread --bs=4k --direct=1 --ioengine=sync --iodepth=1 --runtime=4 --time_based=1 --output-format=json --output="$OUT/fio_read.json" >/dev/null 2>&1 || printf 'fio_read\tfailure\n' >> "$OUT/skipped.tsv"
  fi
else printf 'fio\tmissing_or_low_free_space\n' >> "$OUT/skipped.tsv"; fi
if command -v curl >/dev/null 2>&1; then
  : > "$OUT/http_local.tsv"
  for i in 1 2 3 4 5 6 7 8 9 10; do
    curl --silent --max-time 3 --output /dev/null --write-out '%{http_code}\t%{time_total}\n' 'http://127.0.0.1:3092/healthz' >> "$OUT/http_local.tsv" || printf 'ERR\tNA\n' >> "$OUT/http_local.tsv"
    sleep 0.1
  done
fi
date -u +%Y-%m-%dT%H:%M:%SZ > "$OUT/end_utc"
echo "RESULT=$OUT"
