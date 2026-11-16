#!/usr/bin/env bash
# SSH/FIDO2 migration preflight: read-only. Run on EACH VPS via VNC or existing SSH.
set -u
export LC_ALL=C
printf 'CHECKED_UTC='; date -u +%Y-%m-%dT%H:%M:%SZ
printf 'HOSTNAME='; hostname
printf 'CURRENT_USER='; id -un
if command -v timedatectl >/dev/null 2>&1; then
  timedatectl show -p NTPSynchronized -p NTP 2>/dev/null || true
fi
if getent passwd jmadmin >/dev/null; then
  echo 'JMAN_ACCOUNT=PRESENT'
  id -nG jmadmin 2>/dev/null | sed 's/^/JMAN_GROUPS=/'
  if [[ "$EUID" == 0 ]]; then
    passwd -S jmadmin | awk '{print "JMAN_PASSWORD_STATE=" $2}'
  else
    echo 'JMAN_PASSWORD_STATE=UNKNOWN_REQUIRES_ROOT_CONSOLE'
  fi
  if [[ -s /home/jmadmin/.ssh/authorized_keys ]]; then
    echo 'JMAN_AUTHORIZED_KEYS=NONEMPTY'
  else
    echo 'JMAN_AUTHORIZED_KEYS=EMPTY_OR_MISSING'
  fi
else
  echo 'JMAN_ACCOUNT=MISSING'
fi
if [[ -x /usr/sbin/sshd ]]; then
  if /usr/sbin/sshd -t 2>/dev/null; then
    echo 'SSHD_SYNTAX=OK'
  else
    echo 'SSHD_SYNTAX=FAILED_OR_NEEDS_ROOT'
  fi
  for target in root jmadmin; do
    echo "SSHD_EFFECTIVE_USER=$target"
    /usr/sbin/sshd -T -C "user=$target,host=localhost,addr=127.0.0.1" 2>/dev/null |
      grep -E '^(permitrootlogin|pubkeyauthentication|passwordauthentication|kbdinteractiveauthentication|authenticationmethods|authorizedkeysfile|authorizedkeyscommand|trustedusercakeys|authorizedprincipalsfile|pubkeyacceptedalgorithms|pubkeyauthoptions|allowtcpforwarding|allowagentforwarding|permittty) ' || true
  done
fi
if [[ -r /etc/ssh/ssh_host_ed25519_key.pub ]]; then
  echo 'HOST_KEY_FINGERPRINT_REQUIRES_OUT_OF_BAND_VALIDATION'
  ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub 2>/dev/null || true
fi
if [[ -f /etc/ssh/jm_jogomanager_user_ca.pub ]]; then
  echo 'USER_CA_PUBLIC_KEY_FINGERPRINT'
  ssh-keygen -lf /etc/ssh/jm_jogomanager_user_ca.pub 2>/dev/null || true
else
  echo 'USER_CA=NOT_INSTALLED'
fi
for service in ssh.service sshd.service; do
  if command -v systemctl >/dev/null 2>&1; then
    printf '%s=' "$service"
    systemctl is-active "$service" 2>/dev/null || true
  fi
done
echo 'VNC_ROOT_LOGIN=NOT_VERIFIABLE_BY_SCRIPT'
echo 'JMAN_INTERACTIVE_SUDO=NOT_VERIFIABLE_BY_SCRIPT'
echo 'FIDO2_PIN_TOUCH=NOT_VERIFIABLE_BY_SCRIPT'
echo 'READ_ONLY=TRUE'
