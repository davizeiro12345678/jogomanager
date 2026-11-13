#!/usr/bin/env python3
"""Install pinned, validated third-party ClamAV signature updater with three opt-in feeds.

This script DOES NOT change the official FreshClam databases or apply quarantine.
Review the pinned hashes and upstream license/maintenance before running as root.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import tarfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

TAG = "8.0.0"
BASE = f"https://raw.githubusercontent.com/extremeshok/clamav-unofficial-sigs/{TAG}/"
SOURCES = {
    "clamav-unofficial-sigs.sh": ("clamav-unofficial-sigs.sh", "275d14f4c18d2a36b8d750bcef16fbda66527c15"),
    "master.conf": ("config/master.conf", "c746223e2336fb9f92f3b82434a1a62040a413af"),
    "os.conf": ("config/os/os.ubuntu.conf", "173b8c3298ac6d85c8725c7d6db78871802f0d67"),
}
UPDATER = Path("/usr/local/sbin/clamav-unofficial-sigs.sh")
CONFIG = Path("/etc/clamav-unofficial-sigs")
BACKUP = Path("/var/backups/jm-clamav")
RUNLOG = Path("/var/log/clamav/jm-third-party-updater.log")
USER_CONF = """# Three additional low/medium-noise sources, tagged upstream v8.0.0.
# Keep all existing Sanesecurity and InterServer databases unchanged.
user_configuration_complete="yes"
allow_upgrades="no"
allow_update_checks="no"
remove_disabled_databases="no"
enable_yararules="no"
sanesecurity_enabled="no"
interserver_enabled="no"
malwarepatrol_enabled="no"
malwareexpert_enabled="no"
securiteinfo_enabled="no"
urlhaus_enabled="no"
additional_enabled="no"
yararulesproject_enabled="no"
linuxmalwaredetect_enabled="yes"
linuxmalwaredetect_dbs_rating="LOW"
ditekshen_enabled="yes"
ditekshen_dbs_rating="MEDIUM"
# Avoid detecting legitimate remote-management agents on this VPS.
# Keep only malware-focused ditekshen rules, not indicator_rmm.ldb.
# RMM-specific rule is omitted from the verified upstream master.conf by a narrow patch.
twinclams_enabled="yes"
twinclams_dbs_rating="MEDIUM"
linuxmalwaredetect_update_hours="24"
ditekshen_update_hours="24"
twinclams_update_hours="24"
"""


def git_blob_sha(content: bytes) -> str:
    return hashlib.sha1(f"blob {len(content)}\0".encode() + content).hexdigest()


def fetch_and_verify() -> dict[str, bytes]:
    downloaded = {}
    for name, (path, expected) in SOURCES.items():
        request = urllib.request.Request(BASE + path, headers={"User-Agent": "JogoManagerClamSignatureInstaller/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            content = response.read(500_000)
        actual = git_blob_sha(content)
        if actual != expected:
            raise RuntimeError(f"Refusing {name}: upstream blob SHA does not match pinned tag")
        downloaded[name] = content
        print("PINNED_GIT_BLOB_OK", name, actual, len(content), flush=True)
    return downloaded


def patched_master(data: bytes) -> bytes:
    old = b"indicator_rmm.ldb|MEDIUM # detects remote monitoring and management tooling"
    new = b"# indicator_rmm.ldb|MEDIUM # intentionally disabled on game VPS to avoid RMM false positives"
    if data.count(old) != 1:
        raise RuntimeError("Pinned master config unexpected: cannot disable RMM-only feed")
    return data.replace(old, new, 1)


def save_verified_upgrade(path: Path, data: bytes, previous: bytes, mode: int) -> None:
    if not path.exists():
        save_new(path, data, mode)
        return
    if path.is_symlink():
        raise RuntimeError(f"Symlinked config prohibited: {path}")
    existing = path.read_bytes()
    if existing == data:
        print("ALREADY_CURRENT", path, flush=True)
        return
    if existing != previous:
        raise RuntimeError(f"Existing config not identical to verified previous version: {path}")
    backup = BACKUP / (path.name + ".before-rmm-fix-20261113")
    if backup.exists() and backup.read_bytes() != previous:
        raise RuntimeError(f"Backup conflict: {backup}")
    if not backup.exists():
        fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as out:
            out.write(existing)
    pending = path.with_name(path.name + ".pending")
    fd = os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    with os.fdopen(fd, "wb") as out:
        out.write(data)
        out.flush()
        os.fsync(out.fileno())
    os.chmod(pending, mode)
    os.replace(pending, path)
    print("CONFIG_UPGRADED", path, flush=True)


def save_new(path: Path, data: bytes, mode: int) -> None:
    if path.exists():
        if path.is_symlink() or path.read_bytes() != data:
            raise RuntimeError(f"Refusing to replace existing different file: {path}")
        print("ALREADY_CURRENT", path, flush=True)
        return
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    with os.fdopen(fd, "wb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(path, mode)
    print("INSTALLED", path, flush=True)


def run(command: list[str], timeout: int = 90) -> subprocess.CompletedProcess:
    result = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(f"{command[0]} exited {result.returncode}: {result.stderr[-550:]}")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually install and refresh the signatures")
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise RuntimeError("Run as root through an approved administrator session")
    for command in ("bash", "clamscan", "clamdscan", "curl", "tar"):
        if not shutil.which(command):
            raise RuntimeError(f"Missing required dependency: {command}")
    print("PINNED_UPDATER_VERSION", TAG)
    downloaded = fetch_and_verify()
    if not args.apply:
        print("VERIFIED_DOWNLOADS_ONLY; NO_CHANGES")
        return
    CONFIG.mkdir(parents=True, exist_ok=True, mode=0o750)
    BACKUP.mkdir(parents=True, exist_ok=True, mode=0o700)
    RUNLOG.parent.mkdir(parents=True, exist_ok=True)
    if not (BACKUP / "clamav-third-party-before-v8-20261113.tar.gz").exists():
        with tarfile.open(BACKUP / "clamav-third-party-before-v8-20261113.tar.gz", "w:gz") as tar:
            for path in Path("/var/lib/clamav").iterdir():
                if path.suffix in {".hdb", ".hsb", ".ndb", ".ldb", ".cdb", ".ign2", ".ftm", ".yara"}:
                    if path.is_file() and not path.is_symlink():
                        tar.add(path, arcname=path.name)
        os.chmod(BACKUP / "clamav-third-party-before-v8-20261113.tar.gz", 0o600)
        print("SIGNATURE_BACKUP_CREATED")
    save_new(UPDATER, downloaded["clamav-unofficial-sigs.sh"], 0o750)
    save_verified_upgrade(CONFIG / "master.conf", patched_master(downloaded["master.conf"]), downloaded["master.conf"], 0o640)
    save_new(CONFIG / "os.conf", downloaded["os.conf"], 0o640)
    legacy_line = '# RMM-specific rule is omitted from the verified upstream master.conf by a narrow patch.'
    previous_user = USER_CONF.replace(legacy_line, 'declare -a ditekshen_dbs=( "clamav.ldb|MEDIUM" )').encode()
    save_verified_upgrade(CONFIG / "user.conf", USER_CONF.encode(), previous_user, 0o640)
    run(["bash", "-n", str(UPDATER)])
    info = run([str(UPDATER), "--information"], timeout=50)
    print("UPDATER_CONFIG_CHECK_OK", info.stdout[-1000:].replace("\n", " | "), flush=True)
    with RUNLOG.open("a", encoding="utf-8") as log:
        os.chmod(RUNLOG, 0o640)
        log.write("\n" + datetime.now(timezone.utc).isoformat() + " v" + TAG + "\n")
        log.flush()
        result = subprocess.run([str(UPDATER), "--force"], stdout=log, stderr=subprocess.STDOUT, timeout=900)
    print("UPDATE_EXIT_CODE", result.returncode, flush=True)
    if result.returncode:
        raise RuntimeError(f"Unofficial signature updater returned {result.returncode}; see restricted log")
    # Validate that all three sets have actual files before enabling unattended updates.
    expected = {
        "linux_malware_detect": ["rfxn.ndb", "rfxn.hdb"],
        "ditekshen": ["clamav.ldb"],
        "twinclams": ["twinclams.hdb", "twinclams.ldb", "twinwave.ign2"],
    }
    for source, filenames in expected.items():
        found = [name for name in filenames if (Path("/var/lib/clamav") / name).is_file()]
        print("SIGNATURE_SOURCE", source, "found", ",".join(found), flush=True)
        if source != "twinclams" and not found:
            raise RuntimeError(f"No validated database files installed for {source}")
        if source == "twinclams" and len(found) < 2:
            raise RuntimeError("TwinClams databases or whitelist incomplete")
    run(["systemctl", "is-active", "clamav-daemon.service"])
    print("THREE_SOURCES_INSTALLED_VERIFIED; OFFICIAL_SIGNATURES_PRESERVED", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as ex:
        print("INSTALL_ERROR", type(ex).__name__, str(ex), file=sys.stderr, flush=True)
        raise SystemExit(1)
