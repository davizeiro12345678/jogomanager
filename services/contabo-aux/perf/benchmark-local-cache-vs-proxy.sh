#!/usr/bin/env bash
# Loopback only: catalog proxy, same proxy with edge cache, then independent Sysbench.
# Never calls Auth, Stripe, saves, rooms, or Supabase write APIs.
set -euo pipefail
[[ "${JM_PERF_CANARY:-}" == "YES" ]] || { echo "JM_PERF_CANARY=YES required" >&2; exit 2; }
for cmd in wrk curl sysbench sort awk sha256sum docker; do
  command -v "$cmd" >/dev/null || { echo "missing $cmd" >&2; exit 2; }
done
OUT=$(mktemp -d /tmp/jm-perf-XXXXXXXX)
PURE=http://127.0.0.1:19444/v1/public/clubs?limit=1000
CACHE=http://127.0.0.1:19445/v1/public/clubs?limit=1000
echo "Results: $OUT"
for name in pure cache; do
  if [[ "$name" == pure ]]; then url=$PURE; else url=$CACHE; fi
  [[ $(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "$url") == 200 ]] || {
    echo "HTTP 200 readiness failed for $name" >&2; exit 1;
  }
  curl -fsS --max-time 6 --compressed "$url" | sha256sum | awk '{print $1}' > "$OUT/$name.sha"
  curl -fsS --max-time 6 --compressed "$url" | wc -c > "$OUT/$name.bytes"
done
cmp "$OUT/pure.sha" "$OUT/cache.sha" || { echo "Body mismatch; aborting" >&2; exit 1; }
cmp "$OUT/pure.bytes" "$OUT/cache.bytes" || { echo "Length mismatch; aborting" >&2; exit 1; }
[[ $(curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer synthetic.invalid' "$CACHE") == 400 ]] || exit 1
[[ $(curl -s -o /dev/null -w '%{http_code}' -H 'Cookie: session=synthetic' "$CACHE") == 400 ]] || exit 1
[[ $(curl -s -o /dev/null -w '%{http_code}' -X POST "$CACHE") != 200 ]] || exit 1
[[ $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:19445/v1/auth/me) == 404 ]] || exit 1
echo 'scenario,run,requests_per_second' > "$OUT/http.csv"
for name in pure cache; do
  if [[ "$name" == pure ]]; then url=$PURE; else url=$CACHE; fi
  for round in 1 2 3; do
    wrk -t4 -c64 -d6s --latency -H 'Accept-Encoding: gzip' "$url" > "$OUT/$name.$round.txt"
    rate=$(awk '/Requests\/sec:/ {print $2}' "$OUT/$name.$round.txt")
    [[ -n "$rate" ]] || exit 1
    printf '%s,%d,%s\n' "$name" "$round" "$rate" >> "$OUT/http.csv"
  done
done
echo 'run,events_per_second' > "$OUT/sysbench.csv"
for round in 1 2 3; do
  sysbench cpu --cpu-max-prime=20000 --threads=8 --time=6 --events=0 run > "$OUT/sysbench.$round.txt"
  rate=$(awk '/events per second:/ {print $4}' "$OUT/sysbench.$round.txt")
  [[ -n "$rate" ]] || exit 1
  printf '%d,%s\n' "$round" "$rate" >> "$OUT/sysbench.csv"
done
free -m > "$OUT/memory-after.txt"
cat /proc/pressure/cpu > "$OUT/cpu-pressure-after.txt"
docker stats --no-stream > "$OUT/docker-after.txt" || true
for name in pure cache; do
  median=$(awk -F, -v name="$name" '$1==name {print $3}' "$OUT/http.csv" | sort -n | sed -n 2p)
  echo "$name median: $median requests/s"
done
median=$(awk -F, 'NR>1 {print $2}' "$OUT/sysbench.csv" | sort -n | sed -n 2p)
echo "Sysbench median 8x prime 20000: $median events/s"
echo "Excluded: Supabase CPU, Auth, saves, payments, multiplayer persistence."
