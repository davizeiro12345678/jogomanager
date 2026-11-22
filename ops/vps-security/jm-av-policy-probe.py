"""Read-only, secret-free Elastic Defend and ClamAV policy posture for Wazuh.

This probes local effective endpoint policy without exposing Fleet credentials,
reading malware prevention only, and checks ClamAV's core settings and bounded
on-access ingest scope. No policy is modified and no process is terminated.
"""
from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any


def _options(config: str) -> dict[str, list[str]]:
    values: dict[str, list[str]] = {}
    for line in config.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, _, value = line.partition(" ")
        values.setdefault(key, []).append(value.strip())
    return values


def summarize_clamav(clamd_text: str, onaccess_text: str) -> dict[str, object]:
    daemon = _options(clamd_text)
    access = _options(onaccess_text)
    enabled = lambda name: daemon.get(name, ["no"])[-1].lower() in ("yes", "true")
    access_enabled = access.get("OnAccessPrevention", ["no"])[-1].lower() in ("yes", "true")
    monitored_paths = access.get("OnAccessIncludePath", [])
    core = {
        "archive_scanning": enabled("ScanArchive"),
        "algorithmic_detection": enabled("AlgorithmicDetection"),
        "phishing_signatures": enabled("PhishingSignatures"),
        "bytecode": enabled("Bytecode"),
    }
    healthy = all(core.values()) and access_enabled and "/var/lib/jm-security-ingest" in monitored_paths
    return {
        "integration": "jm_clamav_posture",
        "component": "daemon_and_ingest_scope",
        "jm_state": "ok" if healthy else "degraded",
        **core,
        "onaccess_prevention": access_enabled,
        "onaccess_scope": "ingest_only" if "/var/lib/jm-security-ingest" in monitored_paths else "unverified",
        "pua_detection": enabled("DetectPUA"),
    }


def summarize_elastic(document: dict[str, Any]) -> dict[str, object]:
    sources = document.get("inputs") or []
    linux = next(
        (
            item["policy"]["linux"]
            for item in sources
            if isinstance(item, dict)
            and isinstance(item.get("policy"), dict)
            and isinstance(item["policy"].get("linux"), dict)
        ),
        {},
    )
    malware = linux.get("malware") or {}
    mode = malware.get("mode")
    write = malware.get("on_write_scan") is True
    block = malware.get("blocklist") is True
    healthy = mode == "prevent" and write and block
    return {
        "integration": "jm_elastic_defend",
        "component": "linux_endpoint_policy",
        "jm_state": "ok" if healthy else "degraded",
        "malware_mode": mode if mode in ("prevent", "detect") else "disabled",
        "on_write_scan": write,
        "blocklist": block,
        "behavior_supported": linux.get("behavior_protection", {}).get("supported") is True,
        "memory_supported": linux.get("memory_protection", {}).get("supported") is True,
    }


def snapshots() -> list[dict[str, object]]:
    try:
        clamd = Path("/etc/clamav/clamd.conf").read_text()
        onaccess = Path("/etc/clamav/clamonacc-jm.conf").read_text()
        clamav = summarize_clamav(clamd, onaccess)
    except (OSError, UnicodeError, ValueError):
        clamav = {
            "integration": "jm_clamav_posture",
            "component": "daemon_and_ingest_scope",
            "jm_state": "unverified",
        }

    try:
        import yaml

        result = subprocess.run(
            ["/opt/Elastic/Endpoint/elastic-endpoint", "inspect"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=8,
            check=True,
        )
        parsed = yaml.safe_load(result.stdout)
        if not isinstance(parsed, dict):
            raise ValueError("Unexpected policy shape")
        elastic = summarize_elastic(parsed)
    except (OSError, subprocess.SubprocessError, ImportError, ValueError, TypeError, KeyError):
        elastic = {
            "integration": "jm_elastic_defend",
            "component": "linux_endpoint_policy",
            "jm_state": "unverified",
        }
    return [clamav, elastic]
