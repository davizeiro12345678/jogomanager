"""Check or safely raise Nginx worker file limits to match worker_connections."""

import argparse
import datetime
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time


CONFIG = Path("/etc/nginx/nginx.conf")
TARGET = 65535
COMMENT = "# Allow configured worker_connections plus upstream, cache, and log descriptors."


def update_config(text):
    existing = re.findall(r"^\s*worker_rlimit_nofile\s+(\S+)\s*;", text, re.MULTILINE)
    if existing:
        if len(existing) != 1 or not existing[0].isdigit() or int(existing[0]) < TARGET:
            raise ValueError("Existing worker file limit requires manual review")
        return text
    marker = "worker_processes auto;"
    if text.count(marker) != 1:
        raise ValueError("Unexpected worker_processes configuration")
    return text.replace(marker, f"{marker}\n{COMMENT}\nworker_rlimit_nofile {TARGET};", 1)


def worker_soft_limits():
    master = subprocess.check_output(
        ["systemctl", "show", "nginx", "--property=MainPID", "--value"], text=True
    ).strip()
    children = subprocess.check_output(["pgrep", "-P", master], text=True).split()
    limits = []
    for pid in children:
        try:
            command = Path("/proc", pid, "cmdline").read_bytes().replace(b"\0", b" ").decode()
            if "worker process" not in command or "shutting down" in command:
                continue
            match = re.search(r"^Max open files\s+(\d+)", Path("/proc", pid, "limits").read_text(), re.MULTILINE)
            if match:
                limits.append(int(match.group(1)))
        except (FileNotFoundError, ProcessLookupError):
            continue
    return limits


def apply():
    old = CONFIG.read_text()
    new = update_config(old)
    if old == new:
        print("NGINX_FILE_LIMIT_ALREADY_CONFIGURED")
        return
    info = CONFIG.stat()
    fd, name = tempfile.mkstemp(dir=CONFIG.parent, prefix=".jm-nofile-")
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = CONFIG.with_name(CONFIG.name + ".pre-nofile-" + stamp + ".bak")
    installed = False
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(new)
        os.chmod(name, info.st_mode & 0o7777)
        os.chown(name, info.st_uid, info.st_gid)
        subprocess.run(["nginx", "-t", "-c", name], check=True)
        if CONFIG.read_text() != old:
            raise RuntimeError("Config changed concurrently")
        shutil.copy2(CONFIG, backup)
        if CONFIG.read_text() != old:
            raise RuntimeError("Config changed concurrently")
        os.replace(name, CONFIG)
        installed = True
        subprocess.run(["nginx", "-t"], check=True)
        subprocess.run(["systemctl", "reload", "nginx"], check=True)
        for _ in range(20):
            limits = worker_soft_limits()
            if limits and min(limits) >= TARGET:
                break
            time.sleep(0.25)
        else:
            raise RuntimeError("New worker file limits were not applied")
        print("NGINX_WORKER_FILE_LIMIT_UPDATED")
        print("BACKUP=" + str(backup))
        print("WORKER_SOFT_LIMITS=" + ",".join(map(str, limits)))
    except BaseException:
        if installed and CONFIG.read_text() == new:
            shutil.copy2(backup, CONFIG)
            subprocess.run(["nginx", "-t"], check=False)
            subprocess.run(["systemctl", "reload", "nginx"], check=False)
        raise
    finally:
        if os.path.exists(name):
            os.unlink(name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="apply the change with backup and rollback")
    args = parser.parse_args()
    if args.apply:
        apply()
    else:
        old = CONFIG.read_text()
        print("ALREADY_CONFIGURED" if update_config(old) == old else "CHANGE_AVAILABLE: worker_rlimit_nofile 65535")


if __name__ == "__main__":
    main()
