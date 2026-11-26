# Supabase injury projection: staged production cutover, 13 Nov 2026

Project: `lguqnwvsfeefxamzeyos`, PostgreSQL 17.11. No credentials are stored here.

## Verified live operation

The previous hourly job `jm_refresh_featured_injury_counts_15m` issued a concurrent refresh of a 15GB provider cache's materialized view; historic `pg_stat_statements` mean: 30,404.6 ms per execution (80 recorded calls). This was not a real-time timer, and includes historic load conditions.

Three **applied** migration records on the production Supabase project:

1. `jgm_featured_injury_online_phase1_guarded_triggers_20261113`: private RLS-enabled table and three triggers, installed with a 2.5s lock timeout, no long write lock or scan. Direct reads of raw projected data are revoked from anon, authenticated and service_role.
2. `jgm_featured_injury_online_phase2_resumable_backfill_20261113`: private guarded keyset cursor and function that copies at most 5000 existing injury rows per call (no source write lock); 189,240 legacy injury records scanned, 109,551 featured projected.
3. `jgm_featured_injury_online_phase3_verified_digest_cutover_20261113`: safety gate checked completed backfill and counts before switching `public.get_public_league_digest_source(integer[])` to the incremental private aggregate and unscheduling the hourly full MV refresh. The old materialized view was retained for rollback.

The full read-only reconciliation against `public.api_football_data` found **0 mismatched leagues** and 109,551 injury rows in both the source and projection across 11 populated featured leagues. Trigger INSERT/UPDATE/DELETE behavior passed a transaction-rolled-back test. The public digest RPC returned 12 rows and 109,551 injuries.

After cutover: the old cron has 0 active jobs; the RPC references `private_performance.featured_injury_counts_live`; `anon` has no execute on the RPC; `service_role` retains execute; function stays SECURITY INVOKER.

## Compatibility with canonical migrations

The existing canonical migration `drizzle/migrations/0071_incremental_featured_injury_counts.sql` was updated to use IF NOT EXISTS for the projection tables/index and to **skip scanning the source when the online backfill is marked complete**. It fails closed when a previously started online backfill is incomplete. Fresh databases still seed and reconcile the table.

**Do not** run the original 0071 file from an old commit on this production project, because its non-idempotent CREATE TABLE would conflict and its monolithic backfill could block imported writes.

## Verification/rollback

```sql
SELECT complete,scanned,inserted FROM private_performance.featured_injury_backfill_state;
SELECT sum(injury_count) FROM private_performance.featured_injury_counts_live;
SELECT jobname,active FROM cron.job WHERE jobname='jm_refresh_featured_injury_counts_15m';
SELECT pg_get_functiondef('public.get_public_league_digest_source(integer[])'::regprocedure);
```

During an incident, restore the previous digest function definition from the schema migration / migration history, not by dropping the projection. Only then reschedule the old materialized-view refresh if needed. Avoid exposing private raw injury data to browser roles. Monitor CPU, query latency, WAL, and the importer after cutover. The projection's new writes do incur trigger overhead; compare with a clean before/after window.

The existing VPS/PostgreSQL replication and final application rollout are **independent** of this Supabase database optimization.
