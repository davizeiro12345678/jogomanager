#!/usr/bin/env bash
set -Eeuo pipefail
# Adds trusted CA but DOES NOT lock out root or legacy SSH methods.
if [[ "$EUID" -ne 0 || ! -t 0 || $# -ne 1 || ! -f "$1" ]]; then
  echo "Run as interactive VNC root: $0 /path/to/verified-ca.pub" >&2; exit 2
fi
if ! id jmadmin >/dev/null 2>&1; then echo "Missing jmadmin"; exit 1; fi
if ! grep -Eq '^[[:space:]]*Include[[:space:]]+/etc/ssh/sshd_config.d/\*' /etc/ssh/sshd_config; then
  echo "sshd_config.d Include not verified; aborting." >&2; exit 1
fi
if ! grep -Eq '^(ssh-ed25519|ecdsa-sha2-nistp256) ' "$1"; then
  echo "Unexpected CA public key type"; exit 1
fi
ssh-keygen -lf "$1"
read -r -p "Fingerprint checked out of band and correct VPS? Type CONFIRMO: " answer
[[ "$answer" == CONFIRMO ]] || exit 1
ca_file=/etc/ssh/jm_jogomanager_user_ca.pub
dropin=/etc/ssh/sshd_config.d/60-jm-user-ca.conf
if [[ -e "$ca_file" || -e "$dropin" ]]; then
  echo "Existing CA or config. Manual review required; not overwriting." >&2; exit 1
fi
install -o root -g root -m 0644 "$1" "$ca_file"
printf 'TrustedUserCAKeys %s\n' "$ca_file" > "$dropin"
chmod 0644 "$dropin"
if ! /usr/sbin/sshd -t || ! /usr/sbin/sshd -T -C user=jmadmin,host=localhost,addr=127.0.0.1 | grep -q "^trustedusercakeys $ca_file$"; then
  rm -f "$dropin" "$ca_file"
  echo "Validation failed; removed new files; did not reload SSH." >&2; exit 1
fi
systemctl reload ssh.service
echo "CA installed. Root SSH and legacy methods unchanged."
