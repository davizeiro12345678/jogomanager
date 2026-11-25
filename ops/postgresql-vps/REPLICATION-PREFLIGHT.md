# Direct TLS replication preflight: Supabase -> VPS PostgreSQL

As of **13 Nov 2026**, the target VPS `jm-fra-01.jogomanager.com` resolves the Supabase direct endpoint `db.lguqnwvsfeefxamzeyos.supabase.co` to IPv6 but has **no route to that IPv6 destination**; the attempted `openssl s_client -starttls postgres` failed before TLS negotiation with `Network is unreachable`. Therefore direct TLS connectivity and logical replication are **NOT established**.

## Safe connection prerequisites

1. Prefer enabling a routed global IPv6 address/gateway on the 0Ping VPS via the hosting provider. Do not invent an IPv6 gateway. If the VPS has no IPv6 and routing cannot be provisioned, the paid Supabase IPv4 add-on is a possible alternative, but it requires cost review and owner authorization. **Do not purchase or toggle it automatically.**
2. Supabase logical replication requires **direct PostgreSQL** on port 5432. Shared transaction and session poolers are IPv4-capable, but are **not suitable for logical replication**.
3. Create a separate role with only the necessary `REPLICATION`, `LOGIN` and SELECT privileges on explicitly approved tables. Generate a long random password, inject it into a restrictive out-of-repository `PGPASSFILE` (`0600`), and rotate it by procedure. Do not use `postgres` credentials or the Supabase service-role key in a background replicator.
4. Validate PostgreSQL TLS with `sslmode=verify-full` and the system certificate authority bundle. The `direct-tls-preflight.sh` script checks network connectivity and a real TLS-authenticated query; it never prints the password.
5. **Do not create a persistent logical replication slot until the destination subscription is ready to consume it.** An abandoned slot retains WAL and can exhaust the upstream budget; the Supabase project currently reports `wal_level=logical`, `max_replication_slots=10`, `max_slot_wal_keep_size=2GB`, 0 existing slots and 2 publications.
6. Create an intentionally restricted publication and one-way subscription only for permitted tables; monitor slots and lag with `wal-monitor.sql`. On stale or inactive slots, stop and inspect retention before making changes.

## Privacy and permissions

Postgres logical replication does **not replicate RLS policies, roles, DDL or Supabase Auth/Storage configuration** by itself. A subscriber may store rows beyond what the public Supabase API reveals. Do not replicate `auth.users`, billing, private saves, tokens, or the entire `public.players` table without independently verifying row filters and destination policy enforcement. Keep such data authoritative in Supabase until the host integrity review and end-to-end access-control tests pass.

## What works already

The VPS `jogomanager_local` PostgreSQL 18.7 database has `shared_buffers=14GB`, `max_connections=550` and loopback-only access. The existing one-way HTTPS/RLS public catalog importer and verified cache read path continue functioning without direct PostgreSQL replication.
