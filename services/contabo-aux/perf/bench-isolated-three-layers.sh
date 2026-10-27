#!/usr/bin/env bash
# Read-only loopback benchmark. Does not authenticate users, charge cards, or write saves.
set -euo pipefail

[[ "${JM_BENCH_ISOLATED:-}" == YES ]] || { echo 'Set JM_BENCH_ISOLATED=YES to opt in to load' >&2; exit 2; }
PURE_URL="${JM_PURE_URL:-http://127.0.0.1:19444/v1/public/clubs}"
CACHE_URL="${JM_CACHE_URL:-http://127.0.0.1:19445/v1/public/clubs}"
[[ "$PURE_URL" == http://127.0.0.1:* && "$CACHE_URL" == http://127.0.0.1:* ]] || { echo 'Only loopback URLs are permitted' >&2; exit 2; }
for program in wrk sysbench curl awk sort free; do
  command -v "$program" >/dev/null || { echo "Missing: $program" >&2; exit 2; }
done

OUT="$(mktemp -d /tmp/jm-three-layers.XXXXXXXX)"
printf 'scenario,round,requests_per_second\n' > "$OUT/http.csv"
printf 'round,events_per_second\n' > "$OUT/sysbench.csv"
echo "Logs: $OUT"
for entry in "pure|$PURE_URL" "cache|$CACHE_URL"; do
  kind="${entry%%|*}"; url="${entry#*|}"
  status="$(curl -sS --max-time 3 -o /dev/null -w '%{http_code}' "$url")"
  [[ "$status" == 200 ]] || { echo "$kind was not HTTP 200; refusing load" >&2; exit 1; }
  for round in 1 2 3; do
    wrk -t4 -c64 -d5s --latency "$url" > "$OUT/$kind-$round.txt"
    rate="$(awk '/Requests\/sec:/ {print $2}' "$OUT/$kind-$round.txt")"
    [[ -n "$rate" ]] || exit 1
    printf '%s,%d,%s\n' "$kind" "$round" "$rate" >> "$OUT/http.csv"
  done
done
for round in 1 2 3; do
  sysbench cpu --cpu-max-prime=20000 --threads=8 --time=5 --events=0 run > "$OUT/cpu-$round.txt"
  rate="$(awk '/events per second:/ {print $4}' "$OUT/cpu-$round.txt")"
  [[ -n "$rate" ]] || exit 1
  printf '%d,%s\n' "$round" "$rate" >> "$OUT/sysbench.csv"
done
free -m > "$OUT/memory-after.txt"
cat /proc/pressure/cpu > "$OUT/cpu-pressure-after.txt"
if command -v docker >/dev/null; then docker stats --no-stream > "$OUT/docker-after.txt" || true; fi
for kind in pure cache; do
  median="$(awk -F, -v k="$kind" 'NR>1 && $1==k {print $3}' "$OUT/http.csv" | sort -n | sed -n '2p')"
  echo "MEDIAN $kind requests/s: $median"
done
median="$(awk -F, 'NR>1 {print $2}' "$OUT/sysbench.csv" | sort -n | sed -n '2p')"
echo "MEDIAN Sysbench 8 threads 20k: $median events/s"
echo 'IMPORTANT: auth, purchases, career-save, database writes, and Supabase CPU are NOT covered.'
