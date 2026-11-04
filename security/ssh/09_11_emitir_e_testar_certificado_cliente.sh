#!/usr/bin/env bash
set -Eeuo pipefail
if (( $# != 3 )); then
  echo "Usage: $0 core8|plus6 primaria|reserva HOST_VERIFICADO" >&2; exit 2
fi
server="$1"; token="$2"; host="$3"
case "$server" in core8|plus6) ;; *) exit 2 ;; esac
case "$token" in primaria|reserva) ;; *) exit 2 ;; esac
umask 077
dir="$HOME/.ssh/jm-ssh-pki"
ca="$dir/$server"_user_ca
key="$dir/jogomanager_$token"
for file in "$ca" "$ca.pub" "$key" "$key.pub"; do
  if [[ ! -f "$file" ]]; then echo "Missing file: $file" >&2; exit 1; fi
done
if ! ssh-keygen -F "$host" >/dev/null; then
  echo "Host key not verified in known_hosts. Verify by VNC first." >&2; exit 1
fi
# -1m:+14m = 15 minutes total, allowing 1 minute of clock skew.
identifier="jmadmin-$server-$token-$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM"
ssh-keygen -s "$ca" -I "$identifier" -n jmadmin -V '-1m:+14m' \
  -O clear -O permit-pty -O verify-required "$key.pub"
cert="$key-cert.pub"
ssh-keygen -L -f "$cert"
ssh -tt -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes \
  -o PreferredAuthentications=publickey -o PasswordAuthentication=no \
  -o KbdInteractiveAuthentication=no -i "$key" -o CertificateFile="$cert" \
  "jmadmin@$host" 'id -un; sudo -v; sudo -n true'
echo "Test completed. Repeat for the other physical token and a fresh SSH session."
