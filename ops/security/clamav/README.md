# ClamAV corrective actions and three verified signature sources

## Findings from the VPS (13 November 2026)

ClamAV **1.5.4** and FreshClam are installed. The latest verified full scan examined **342,710 files**, scanned **38.34 GiB** and recorded **15 third-party UNOFFICIAL detections** in development caches and test ZIP files. This is **not** proof of 15 malicious infections. The scanner returns exit code 1 for detections, and the existing systemd unit incorrectly treats that result as an operational failure.

## Step 1: correct reporting

Copy `70-detection-status.conf` into `/etc/systemd/system/jm-clamav-scan.service.d/`. Then run `systemctl daemon-reload`, `systemd-analyze verify jm-clamav-scan.service`, and `systemctl reset-failed jm-clamav-scan.service`.

`SuccessExitStatus=1` tells systemd that detections are a *completed* scan; **it does not suppress FOUND lines or make a positive scan clean**. Errors returning exit code 2 remain failures. Never run `--remove` or `--move` automatically.

## Step 2: add three independent signature sources

Use `install-third-party-signatures.py` to fetch a **pinned** tag `8.0.0` from eXtremeSHOK's ClamAV unofficial signatures updater. Each file is checked against its Git blob hash (not a cryptographic vendor signature). The script backs up existing nonofficial signature files and configures **only**:
- R-fx Networks Linux Malware Detect (`rfxn.ndb`, `rfxn.hdb`, risk LOW)
- ditekshen/detection (`clamav.ldb`, risk MEDIUM; optional RMM detections also require review)
- Splunk/TwinWave twinclams (`twinclams.hdb`, `twinclams.ldb`, `twinwave.ign2`, risk MEDIUM)

Previously installed SaneSecurity and InterServer databases remain in place; `remove_disabled_databases=no` protects them from disabled-source cleanup. This installation does **not** attempt to replace or automatically upgrade the official FreshClam databases. Self-upgrade of the third-party updater is disabled.

Execute `python3 install-third-party-signatures.py` first for pinned-download verification only. Only after inspecting the pinned code and its source lists should an administrator execute `python3 install-third-party-signatures.py --apply`. The updater validates databases before placing them in the ClamAV data directory; reject incomplete feeds and do not enable the timer until the installed sources and daemon are verified.

Then install `jm-third-party-signatures.service` and `jm-third-party-signatures.timer` under `/etc/systemd/system`, verify with `systemd-analyze verify` and enable only after a fully successful first run. The service is configured to run daily at a randomized time and with limited CPU and memory.

## Step 3: test and preserve alerts

Verify `freshclam`, `clamdscan --ping=1`, and the total signatures loaded. Scan a **harmless standardized EICAR test file in an isolated temporary directory**, then remove that test file after confirming detection. Start a **new full-scan systemd job** and check its journal and final result. A full scan previously took over two hours, so do not mark it completed until the final report and total scanned-file count are recorded.

Review positive findings one by one, especially `Sanesecurity.Phishing.Fake.31740.UNOFFICIAL` and `Sanesecurity.Foxhole.Zip_SFN1.UNOFFICIAL`. Confirm hashes and package provenance before allowing any signature-specific whitelist. Avoid disabling entire databases due to false positives.

## Security restrictions

Never run remote root scripts downloaded without validation, allow an external signature provider to modify PostgreSQL configuration, or auto-delete content from user or server directories. A clean antivirus scan alone would not prove an earlier compromised root user has been removed. Review root/SSH keys, unexpected units, apt hooks, authorized users and executable integrity before sensitive database replication.
