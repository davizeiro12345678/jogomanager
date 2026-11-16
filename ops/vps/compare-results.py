#!/usr/bin/env python3
"""Summarize JogoManager VPS benchmark directories without guessing missing data."""
import argparse
import json
import math
import re
from pathlib import Path


def metric_from_text(path, pattern):
    if not path.exists():
        return None
    match = re.search(pattern, path.read_text(encoding="utf-8", errors="replace"), re.I)
    return float(match.group(1)) if match else None


def read_metrics(directory):
    directory = Path(directory)
    target = (directory / "target").read_text().strip()
    profile = (directory / "profile").read_text().strip() if (directory / "profile").exists() else "safe"
    numbers = {}
    for count in (1, 2, 4, 6, 8):
        path = directory / f"cpu_{count}.txt"
        value = metric_from_text(path, r"events per second:\s*([\d.]+)")
        if value is not None:
            numbers[f"sysbench_cpu_{count}_events_s"] = value
    for name in ("ram_speed", "ram_1"):
        value = metric_from_text(directory / f"{name}.txt", r"\(([\d.]+)\s+MiB/sec\)")
        if value is not None:
            numbers["memory_MiB_s"] = value
    for name in ("fio_write", "fio_read", "fio_seqwrite", "fio_randread", "fio_randwrite"):
        path = directory / f"{name}.json"
        if not path.exists():
            continue
        try:
            jobs = json.loads(path.read_text(encoding="utf-8"))["jobs"]
            direction = "read" if "read" in name else "write"
            info = jobs[0].get(direction, {})
            bw = info.get("bw_bytes")
            iops = info.get("iops")
            if isinstance(bw, (int, float)):
                numbers[f"{name}_MiB_s"] = float(bw) / 1048576
            if isinstance(iops, (int, float)):
                numbers[f"{name}_iops"] = float(iops)
        except (ValueError, KeyError, IndexError, TypeError):
            pass
    http_path = directory / "http_local.tsv"
    if http_path.exists():
        durations = []
        codes = []
        for line in http_path.read_text(encoding="utf-8").splitlines():
            parts = line.split("\t")
            if len(parts) >= 2:
                codes.append(parts[0])
                try:
                    durations.append(float(parts[1]) * 1000)
                except ValueError:
                    pass
        if durations:
            durations.sort()
            numbers["http_local_p50_ms"] = durations[(len(durations) - 1) // 2]
            numbers["http_local_p95_ms"] = durations[max(0, math.ceil(len(durations) * 0.95) - 1)]
            numbers["http_local_success_pct"] = (sum(c == "200" for c in codes) / len(codes)) * 100
    return target, profile, numbers


def compare(before, after):
    t1, p1, b = read_metrics(before)
    t2, p2, a = read_metrics(after)
    if t1 != t2:
        raise ValueError(f"Invalid comparison: different VPS targets ({t1} vs {t2})")
    if p1 != p2:
        raise ValueError(f"Invalid comparison: different benchmark profiles ({p1} vs {p2})")
    rows = [f"# JogoManager VPS benchmark: {t1}", "",
            f"Profile: {p1}. Percentages are raw differences, not claims of causality.", "",
            "| Metric | Before | After | Change |", "|---|---:|---:|---:|"]
    for key in sorted(set(b) | set(a)):
        x, y = b.get(key), a.get(key)
        left = f"{x:.2f}" if x is not None else "not measured"
        right = f"{y:.2f}" if y is not None else "not measured"
        change = f"{(y / x - 1) * 100:+.1f}%" if x is not None and y is not None and x != 0 else "n/a"
        rows.append(f"| {key} | {left} | {right} | {change} |")
    rows += ["", "Missing categories are explicitly marked. Run before and after on the same VPS, similar load and versions.",
             "Raw output directories may contain operational details; do not publish them unreviewed."]
    return "\n".join(rows) + "\n"


def self_test():
    from tempfile import TemporaryDirectory
    with TemporaryDirectory() as tmp:
        b = Path(tmp) / "b"; a = Path(tmp) / "a"
        b.mkdir(); a.mkdir()
        for p in (b, a):
            (p / "target").write_text("core8\n")
            (p / "profile").write_text("safe\n")
        (b / "cpu_1.txt").write_text("events per second: 100.00\n")
        (a / "cpu_1.txt").write_text("events per second: 150.00\n")
        assert "50.0%" in compare(b, a)
        (a / "target").write_text("plus6\n")
        try:
            compare(b, a)
        except ValueError:
            pass
        else:
            raise AssertionError("Cross-host comparison was not rejected")
    print("SELF_TEST_OK")


def main():
    parser = argparse.ArgumentParser(description="Compare before/after VPS benchmark results")
    parser.add_argument("before", nargs="?")
    parser.add_argument("after", nargs="?")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
    elif args.before and args.after:
        print(compare(args.before, args.after), end="")
    else:
        parser.error("Supply BEFORE and AFTER directories or --self-test")


if __name__ == "__main__":
    main()
