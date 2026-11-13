#!/usr/bin/env bash
# Safe verification for a DIRECT Supabase PostgreSQL connection.
# Does NOT create WAL slots, roles, publications, subscriptions or copy rows.
set -euo pipefail
readonly HOST="db.lguqnwvsfeefxamzeyos.supabase.co"
readonly ROOT_CA="/etc/ssl/certs/ca-certificates.crt"
: "${JM_REPLICATION_USER:?Set the dedicated replication role in environment}"
: "${PGPASSFILE:?Set PGPASSFILE to a root-readable, 0600, out-of-repository file}"
test -r "$PGPASSFILE"
test "$(stat -c %a "$PGPASSFILE")" = "600" || { echo "PGPASSFILE must be mode 0600" >&2; exit 3; }
test -r "$ROOT_CA"
if ! ip -6 route get "$(getent ahostsv6 "$HOST" | awk 'NR==1{print $1}')" >/dev/null 2>&1; then
  echo "DIRECT_IPV6_UNREACHABLE: provision IPv6 routing or separately approve Supabase IPv4 add-on" >&2
  exit 4
fi
/usr/lib/postgresql/18/bin/psql "host=$HOST port=5432 dbname=postgres user=$JM_REPLICATION_USER sslmode=verify-full sslrootcert=$ROOT_CA connect_timeout=8 application_name=jm_vps_replication_preflight" \
  --no-psqlrc --set ON_ERROR_STOP=1 \
  --command "SELECT current_setting('server_version'), ssl, version, cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid();"
