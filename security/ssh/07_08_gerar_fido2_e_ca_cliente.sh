#!/usr/bin/env bash
set -Eeuo pipefail
if (( $# != 2 )); then
  echo "Usage: $0 fido2 primaria|reserva   OR   $0 ca core8|plus6" >&2
  exit 2
fi
umask 077
dir="$HOME/.ssh/jm-ssh-pki"
mkdir -p "$dir"
case "$1" in
  fido2)
    case "$2" in primaria|reserva) ;; *) exit 2 ;; esac
    output="$dir/jogomanager_$2"
    if [[ -e "$output" || -e "$output.pub" ]]; then echo "Existing key: refusing overwrite"; exit 1; fi
    echo "Insert the matching PHYSICAL FIDO2 token, with configured PIN/touch."
    algorithm=ed25519-sk
    if [[ -v JM_FIDO_ALGO ]]; then algorithm="$JM_FIDO_ALGO"; fi
    case "$algorithm" in ed25519-sk|ecdsa-sk) ;; *) echo "Invalid FIDO algorithm"; exit 2 ;; esac
    ssh-keygen -t "$algorithm" -O verify-required -f "$output" -C "jogomanager-$2"
    chmod 600 "$output"
    ;;
  ca)
    case "$2" in core8|plus6) ;; *) exit 2 ;; esac
    output="$dir/$2"_user_ca
    if [[ -e "$output" || -e "$output.pub" ]]; then echo "Existing CA: refusing overwrite"; exit 1; fi
    echo "Choose a strong passphrase. Keep private CA OFF the VPS and away from cloud storage."
    ssh-keygen -t ed25519 -a 100 -f "$output" -C "jogomanager-$2-user-ca"
    chmod 600 "$output"
    ssh-keygen -lf "$output.pub"
    ;;
  *) exit 2 ;;
esac
echo "Created; never transfer private CA to any server."
