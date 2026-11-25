#!/usr/bin/env python3
"""Preserve every large AV scan input in the deep-scan fallback.

Magic bytes cannot prove the absence of embedded archives or polyglots.
A path-only list also cannot bind classification to the later scanner's
open file descriptor. Until the scanner consumes a trusted stable object
under equivalent inspection policy, no input qualifies for the fast path.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def _atomic_write(dst: Path, entries: list[bytes]) -> None:
    staging = dst.with_name(dst.name + ".tmp")
    fd = os.open(staging, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "wb") as out:
            for path in entries:
                out.write(path + b"\n")
        os.replace(staging, dst)
    except BaseException:
        try:
            staging.unlink(missing_ok=True)
        except OSError:
            pass
        raise


def split(source: Path, shared_out: Path, deep_out: Path) -> dict[str, int]:
    original = source.read_bytes().splitlines()
    if any(not entry.startswith(b"/") or b"\0" in entry for entry in original):
        raise ValueError("Invalid absolute filename: abort classification")
    if shared_out == deep_out or source in (shared_out, deep_out):
        raise ValueError("Output paths must differ from each other and input")
    shared, deep = [], list(original)
    if len(shared) + len(deep) != len(original):
        raise ValueError("Classification did not preserve every file")
    _atomic_write(shared_out, shared)
    _atomic_write(deep_out, deep)
    return {"shared_daemon": len(shared), "deep_fallback": len(deep), "total": len(original)}


def main() -> int:
    if len(sys.argv) != 4:
        print("Usage: jm-security-large-split.py INPUT SHARED_OUTPUT DEEP_OUTPUT", file=sys.stderr)
        return 64
    try:
        result = split(*(Path(item) for item in sys.argv[1:]))
    except (OSError, ValueError) as exc:
        print("LARGE_FILE_PARTITION_FAILED=" + type(exc).__name__, file=sys.stderr)
        return 2
    print("LARGE_FILE_PARTITION=" + json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
