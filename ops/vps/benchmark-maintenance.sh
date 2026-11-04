#!/usr/bin/env bash
# JogoManager VPS extended benchmark. RUN ONLY IN APPROVED MAINTENANCE.
# May noticeably increase CPU and disk I/O, even under nice/ionice.
set -Eeuo pipefail
umask 077
export LC_ALL=C
if (( $# != 2 )); then echo 'Usage: bash ops/vps/benchmark-maintenance.sh core8|plus6 before|after' >&2; exit 2; fi
LABEL="$1"; PHASE="$2"
case "$LABEL" in core8) EXPECT=194.163.188.190;; plus6) EXPECT=144.91.111.116;; *) exit 2;; esac
case "$PHASE" in before|after) ;; *) exit 2;; esac
if (( EUID == 0 )); then echo 'Refusing root'; exit 3; fi
if [[ "${JM_MAINTENANCE_APPROVED:-}" != 1 ]]; then
  echo 'Set JM_MAINTENANCE_APPROVED=1 only during a verified maintenance window.' >&2; exit 3
fi
if grep -qiE 'microsoft|wsl' /proc/sys/kernel/osrelease; then echo 'Refusing WSL'; exit 3; fi
command -v ip >/dev/null && ip -o -4 addr show scope global | grep -Fq "$EXPECT/" ||
  { echo 'Wrong target/host identity'; exit 3; }
if ! command -v sysbench >/dev/null || ! command -v fio >/dev/null; then
  echo 'Missing sysbench or fio. No automatic installation.' >&2; exit 4
fi
NPROC=$(getconf _NPROCESSORS_ONLN)
[[ "$NPROC" =~ ^[0-9]+$ ]] || exit 4
FREE_MB=$(df -Pm . | awk 'END{print $4+0}')
(( FREE_MB >= 2048 )) || { echo 'At least 2 GiB filesystem headroom required'; exit 4; }
OUT="$(pwd -P)/results/$LABEL/$(date -u +%Y%m%dT%H%M%SZ)-$PHASE-maintenance"
mkdir -p "$OUT"; chmod 0700 "$OUT"
printf '%s\n' "$LABEL" > "$OUT/target"
printf '%s\n' "$PHASE" > "$OUT/phase"
printf '%s\n' "approved-maintenance" > "$OUT/profile"
date -u +%Y-%m-%dT%H:%M:%SZ > "$OUT/start_utc"
cat /proc/stat > "$OUT/stat_before"
cat /proc/pressure/cpu > "$OUT/psi_cpu_before" 2>/dev/null || true
cat /proc/pressure/io > "$OUT/psi_io_before" 2>/dev/null || true
cat /proc/diskstats > "$OUT/diskstats_before"
: > "$OUT/skipped.tsv"
for threads in 1 2 4 6 8; do
  if (( threads > NPROC )); then
    printf 'cpu_%s\tmore_than_online_cpus\n' "$threads" >> "$OUT/skipped.tsv"; continue
  fi
  timeout 16s nice -n 15 sysbench cpu --cpu-max-prime=10000 \
    --threads="$threads" --time=8 --events=0 run > "$OUT/cpu_$threads.txt" 2>&1 ||
    printf 'cpu_%s\tfailed\n' "$threads" >> "$OUT/skipped.tsv"
  sleep 2
done
timeout 13s nice -n 15 sysbench memory --threads=1 --time=7 \
  --memory-total-size=512M run > "$OUT/ram_1.txt" 2>&1 ||
  printf 'memory\tfailed\n' >> "$OUT/skipped.tsv"
SCRATCH=$(mktemp -d "$OUT/fio.XXXXXXXX")
trap 'rm -rf -- "$SCRATCH"' EXIT
# Exactly one 256MiB temporary scratch file. No block-device benchmarks.
for pattern in write randread randwrite; do
  timeout 20s nice -n 15 fio --name="jm-$pattern" \
    --filename="$SCRATCH/benchmark.bin" --size=256m --rw="$pattern" \
    --bs=4k --direct=1 --ioengine=sync --iodepth=1 \
    --runtime=8 --time_based=1 --output-format=json \
    --output="$OUT/fio_$pattern.json" >/dev/null 2>&1 ||
    printf 'fio_%s\tfailed\n' "$pattern" >> "$OUT/skipped.tsv"
  sleep 2
done
cat /proc/stat > "$OUT/stat_after"
cat /proc/pressure/cpu > "$OUT/psi_cpu_after" 2>/dev/null || true
cat /proc/pressure/io > "$OUT/psi_io_after" 2>/dev/null || true
cat /proc/diskstats > "$OUT/diskstats_after"
date -u +%Y-%m-%dT%H:%M:%SZ > "$OUT/end_utc"
echo "RESULT=$OUT"
echo 'This is a bounded same-host synthetic test, not maximum hardware performance.'
