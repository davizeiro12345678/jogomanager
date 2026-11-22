#!/usr/bin/env python3
"""Classify large AV scan inputs without changing coverage or file contents.

Only validated uncompressed ELF, GGUF and SafeTensors inputs use the shared
clamd daemon. Unknown files, archives, symlinks and unreadable paths retain
the legacy standalone clamscan with deep archive recursion. Fail closed.
"""
from __future__ import annotations

import json
import os
import stat
import sys
from pathlib import Path


def _safe_for_shared_daemon(raw_path: bytes) -> bool:
    flags = os.O_RDONLY | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(raw_path, flags)
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode):
                return False
            head = os.read(fd, 32)
        finally:
            os.close(fd)
    except OSError:
        return False
    if head.startswith(b"\x7fELF") or head.startswith(b"GGUF"):
        return True
    if raw_path.lower().endswith(b".safetensors") and len(head) >= 9:
        declared = int.from_bytes(head[:8], "little")
        return 2 <= declared <= 16 * 1024 * 1024 and head[8:9] == b"{"
    return False


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
    shared, deep = [], []
    for entry in original:
        (shared if _safe_for_shared_daemon(entry) else deep).append(entry)
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
