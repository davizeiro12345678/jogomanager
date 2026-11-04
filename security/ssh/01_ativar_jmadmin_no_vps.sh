#!/usr/bin/env bash
set -Eeuo pipefail
# Only run INTERACTIVELY via the verified Contabo VNC console, as root.
if [[ "$EUID" -ne 0 || ! -t 0 ]]; then
  echo "Use root on an interactive VNC terminal; no remote unattended execution." >&2
  exit 1
fi
if ! id jmadmin >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash jmadmin
fi
usermod -aG sudo jmadmin
echo "Define the jmadmin password LOCALLY in VNC. Never paste it into chat."
passwd jmadmin
passwd -S jmadmin
id jmadmin
if command -v visudo >/dev/null; then visudo -c; fi
echo "User ready. Test a NEW SSH login and password-protected sudo."
echo "No root SSH, existing keys or sshd settings were changed."
