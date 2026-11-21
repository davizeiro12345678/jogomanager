#!/usr/bin/env python3
"""Compact k6 telemetry report; counts actual HTTP requests per UTC second."""
import collections
import datetime as dt
import json
import pathlib
import statistics
import sys

def report(path: pathlib.Path):
    counts = collections.Counter()
    total = 0
    with path.open(encoding="utf-8", errors="replace") as handle:
        for line in handle:
            try:
                data = json.loads(line)
                if data.get("type") != "Point" or data.get("metric") != "http_reqs":
                    continue
                point = data["data"]
                stamp = dt.datetime.fromisoformat(point["time"].replace("Z", "+00:00"))
                second = int(stamp.timestamp())
                num = int(point.get("value", 1))
                if num < 1 or num > 10000:
                    continue
                counts[second] += num
                total += num
            except (KeyError, ValueError, TypeError, json.JSONDecodeError):
                continue
    seconds = sorted(counts)
    if not seconds:
        raise ValueError("No requests measured; do not claim throughput.")
    peak = max(counts.values())
    mean = total / (seconds[-1] - seconds[0] + 1)
    peak_5s_average = max(
        sum(counts.get(second + offset, 0) for offset in range(5)) / 5
        for second in seconds
    )
    result = {
        "total_requests_observed": total,
        "observed_interval_seconds": seconds[-1] - seconds[0] + 1,
        "average_rps": round(mean, 2),
        "peak_one_second_rps": peak,
        "maximum_five_second_mean_rps": round(peak_5s_average, 2),
        "target_4000_rps_for_5_seconds_proven": peak_5s_average >= 4000,
        "note": "Observed generator throughput, not a guarantee of target resilience; validate 5xx, p95, dropped_iterations, and app-specific metrics separately.",
    }
    return result

if __name__ == "__main__":
    path = pathlib.Path(sys.argv[1])
    output = pathlib.Path(sys.argv[2])
    try:
        result = report(path)
        output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result, indent=2))
        sys.exit(0 if result["target_4000_rps_for_5_seconds_proven"] else 2)
    except (OSError, ValueError) as error:
        print(f"Load sample processing FAILED: {error}", file=sys.stderr)
        sys.exit(3)
