# JogoManager: local PostgreSQL cache mirror

**Intended target:** 0Ping VPS, Ubuntu 24.04 LTS, PostgreSQL **18.7** (latest stable on 2026-11-12; PostgreSQL 19 is only RC). The hosted Supabase `lguqnwvsfeefxamzeyos` PostgreSQL is authoritative and must not be upgraded or altered by this deployment.

This is a **one-way, replaceable, public-catalog read cache**. It is **not a complete database replica** or a source of truth for match settlements. Player authentication, careers, invoices, saves, room secrets, and final match results remain hosted by Supabase with existing RLS/authorization checks. No service-role key is required or permitted.

## PostgreSQL major upgrade: gated procedure

Do not automatically execute this on an untrusted host. First complete the malware scan, remediate the prior VPS compromise, verify administrative control, and take a restorable off-host backup.

1. Inspect `pg_lsclusters`, `df -h`, `free -h`, `ss -lnt`, `pg_upgradecluster --help`, and service dependencies. Determine if `16/main` is still the only local cluster and `jogomanager_local` remains isolated.
2. Save `/etc/postgresql/16` and an **encrypted/off-host** backup of the local cluster. Run as PostgreSQL owner: `pg_dumpall > /root/restricted-backup.sql` only when shell redirection runs as the intended privileged user; restrict backup file permissions to `0600` before writing. Verify restore using a separate database/cluster. Never copy production Supabase credentials into a dump.
3. Enable the **official PGDG apt repository**, using its `noble-pgdg` source and `Signed-By` key fingerprint `B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8`. Verify that `apt-cache policy postgresql-18` offers **18.7** and does not offer a release candidate.
4. Install `postgresql-18` and `postgresql-client-18`. Debian/Ubuntu may auto-create a new, empty `18/main` cluster on a secondary port. Inspect it carefully; don't delete a preexisting populated 18 cluster. After confirming an auto-created 18 cluster is empty, use the documented `pg_upgradecluster -v 18 16 main` workflow (after removing **only** that verified empty auto-cluster if necessary). For nontrivial data, prefer `--method=upgrade`, after running the official compatibility checks.
5. Preserve the old 16 cluster and backups (do **not** drop it). Validate the new `18/main` running on loopback port `5432`, the `jogomanager_local` database, roles, extensions, backups, and existing application services.
6. In `/etc/postgresql/18/main/conf.d/90-jogomanager-local.conf`, start conservatively with:

   ```conf
   listen_addresses = '127.0.0.1'
   password_encryption = 'scram-sha-256'
   shared_buffers = '14GB'
   effective_cache_size = '24GB'
   work_mem = '4MB'
   maintenance_work_mem = '512MB'
   autovacuum_work_mem = '256MB'
   max_connections = 550
   reserved_connections = 10
   superuser_reserved_connections = 5
   max_wal_size = '4GB'
   checkpoint_completion_target = 0.9
   effective_io_concurrency = 64
   track_io_timing = on
   shared_preload_libraries = 'pg_stat_statements'
   ```

   `effective_cache_size` is a planner hint, not a memory reservation. `shared_buffers` uses actual RAM. PostgreSQL major upgrades need tuning/benchmarking; larger values do not guarantee greater speed.
7. Restart just the new PostgreSQL cluster, not the VPS. Verify actual applied settings (`SHOW shared_buffers`, `SHOW effective_cache_size`), `pg_isready`, an authorized local `SELECT 1`, and the absence of public port `5432` exposure. Re-enable `pg_stat_statements` and `pg_prewarm` if necessary. Keep the old cluster stopped but available until restore and rollback are tested.

Official reference: https://www.postgresql.org/download/linux/ubuntu/ and https://www.postgresql.org/docs/18/pgupgrade.html

## Local mirror deployment, after PostgreSQL is healthy

Install this directory to `/opt/jm-postgres-mirror`, owned by root. Apply `schema.sql` to **local** `jogomanager_local` as PostgreSQL superuser once. This creates schema `jm_cache`, with owner-controlled writes and a **read-only** `jmsbapi` role for the loopback VPS API. Do not apply this schema to Supabase.

The sync script uses existing `/etc/jogomanager/supabase-public.env`, which must include only:

- `SUPABASE_URL=https://lguqnwvsfeefxamzeyos.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY=...` (public, not administrative)

It explicitly refuses to run if either privileged key is present. `postgres` needs Unix socket peer access to local `jogomanager_local` via `psql`.

```sh
sudo -u postgres python3 /opt/jm-postgres-mirror/sync_public_catalog.py --tables competitions clubs
sudo -u postgres psql -d jogomanager_local -c "select kind,count(*) from jm_cache.catalog_entries group by kind"
# Then run the players snapshot during a low-load window.
sudo -u postgres python3 /opt/jm-postgres-mirror/sync_public_catalog.py --tables players
```

The configured timers are hourly (competitions/clubs) and twice daily (public athlete fields). **Before** enabling the timers, validate the data counts against RLS-visible Supabase results. Each table refresh performs a paginated public HTTP fetch, validates the minimum row count and duplicate IDs, then swaps the snapshot in one **local** PostgreSQL transaction. An unexpected loss of over 20% of previously cached rows fails closed. There is no write to Supabase.

Install `jm-catalog-mirror.service`, `jm-catalog-mirror.timer`, `jm-player-mirror.service`, and `jm-player-mirror.timer` in `/etc/systemd/system`; then run `systemctl daemon-reload` and enable only the timers after manually testing both jobs. Verify with `journalctl -u jm-catalog-mirror.service -n 100` and `journalctl -u jm-player-mirror.service -n 100`.

Do **not** point private endpoints or the match-authority settlement code at the public cache. The server's `/v1/competitions` route can later use a locally pooled PostgreSQL connection with `jmsbapi`, falling back to the Supabase API on cache miss. Never allow a browser to issue arbitrary SQL against this mirror.

## Tests and rollback

Run `python3 -m unittest test_sync_public_catalog.py` before deploying. For reversal, disable both timers and leave the local catalog intact; the existing VPS API continues to query Supabase until it is explicitly switched. Roll back the PostgreSQL major upgrade to the old cluster only after ensuring the new version has not accepted writes that the old version lacks. Test restoring the off-host backup.

**Not performed by this repository:** installing packages on the VPS, copying any secret, refreshing private user data, or starting ClamAV. These are separate authorized server operations.
## 13 Nov 2026: live sizing and extended public mirror

The VPS local PostgreSQL 18.7 is verified at `shared_buffers=14GB`, `max_connections=550`, `work_mem=4MB`, `effective_cache_size=24GB`, `reserved_connections=10`, and `superuser_reserved_connections=5`. PostgreSQL stays on loopback. The prior configuration and pre-change database dump were saved under `/var/backups/jm-postgresql`. The 550 slots are a maximum, not a target of 550 simultaneous heavy queries. The 14GB buffer allocation is substantial relative to the initial local data size, and has not demonstrated a performance advantage yet.

The read-only Supabase catalog mirror supports six additional RLS-public tables: `stadiums`, `kits`, `competition_seasons`, `official_teams`, `official_venues`, and `official_players`. Apply `migrations/20261113_expand_public_catalog.sql` ONLY to the local `jogomanager_local` cluster, deploy the updated Python importer, verify every catalog count and then enable `jm-expanded-catalog-mirror.timer` for a low-load daily update.

The local database is **not** a complete or bidirectional replica. Confidential `api_football_data`, auth records, careers, saves, subscriptions, payments, and match settlements stay authoritative in Supabase. Authenticated API requests must continue to enforce each user's JWT and row-level permissions. Full direct PostgreSQL logical replication requires a restricted replication credential, verified TLS, retention/lag monitoring, a security audit of the VPS, and an explicit table scope; never copy a Supabase service-role key into clients or this repository.
