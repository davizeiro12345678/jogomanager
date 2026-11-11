# PostgreSQL performance investigation — featured injury counts

## Observed production signal

A production `pg_stat_statements` sample showed 26 calls to:

`REFRESH MATERIALIZED VIEW CONCURRENTLY private_performance.featured_injury_counts`

with approximately 30.6 seconds mean execution time and 32.3 seconds maximum. The scheduled job is named `jm_refresh_featured_injury_counts_15m`, but the observed cron schedule was hourly (`0 * * * *`). The materialized view is small (about 32 kB) and has one index; the source table has a partial index for injury league/time lookups.

Do not change the schedule or replace the concurrent refresh with a blocking refresh until the cause is established. The view may be waiting on locks or I/O rather than spending 30 seconds aggregating rows.

## Additional production evidence and corrective action

A read-only production sample on 11 November 2026 found:

- `api_football_data`: approximately 10.23 million live tuples, 14 GB total relation size and 122,197 estimated dead tuples.
- `last_autovacuum` and `last_vacuum`: both NULL in the sampled statistics.
- Table reloptions: vacuum scale factor 5% / threshold 500; analyze scale factor 2% / threshold 500.
- Those settings defer vacuum until roughly 512,000 dead tuples and analyze until roughly 205,000 modified tuples. The sample had only 122,197 dead tuples and 83,833 modifications since analyze, so routine maintenance had not been triggered.
- The injury digest consistently completed in about 30.2–31.9 seconds. Its plan used `api_football_injury_league_time_idx`, so the issue is not a missing index or a missing unique index on the materialized view.

The integration adds migration `0070_api_football_data_autovacuum_tuning.sql`, lowering the per-table vacuum/analyze thresholds to 0.5% plus 20,000 rows. This is metadata-only; it does not rewrite the 14 GB table. Once deployed, autovacuum should become eligible at the current dead-tuple/modification counts. Do not run a manual `VACUUM FULL` (it rewrites and locks the table). If immediate visibility-map maintenance is required, schedule ordinary `VACUUM (ANALYZE) public.api_football_data;` in a controlled window.

Acceptance: confirm a successful autovacuum/analyze in `pg_stat_user_tables`, then compare at least 10 refresh durations and confirm the plan improves to an index-only scan where visibility permits. Keep the unique `featured_injury_counts_pk` index and concurrent refresh.

## Verification after the 11 November 2026 production change

The per-table thresholds were applied and read back successfully. PostgreSQL then completed an autovacuum at `2026-11-11 19:26:01 UTC` and an autoanalyze at `19:25:51 UTC`. The subsequent `pg_stat_user_tables` sample reported:

- `n_dead_tup = 0`
- `n_mod_since_analyze = 0`
- `last_autovacuum = 2026-11-11 19:26:01 UTC`
- `last_autoanalyze = 2026-11-11 19:25:51 UTC`

This confirms the maintenance threshold change took effect and the 122,197 estimated dead tuples were cleared. The remaining acceptance test is the next scheduled `featured_injury_counts` refresh: record its duration and plan after the visibility map has been refreshed. Do not claim the 30-second refresh is fixed until that measurement is captured.

## Current index state and safe next optimization

A fresh read-only catalog inspection on 11 November 2026 confirmed:

- `api_football_injury_league_time_idx` is valid, ready and live (about 1.9 MiB).
- `api_football_data_pkey`, `api_football_public_team_time_idx` and `api_football_team_profile_lookup_idx` are also valid.
- `private_performance.featured_injury_counts_pk` is a valid unique index.
- No `api_football_injury_league_cover_idx` or `api_football_injury_league_cover_v2_idx` exists in the production catalog. No invalid index remains on `public.api_football_data`.

A candidate covering expression index named `api_football_injury_league_cover_idx` was attempted with `CREATE INDEX CONCURRENTLY`, but the 120-second statement timeout cancelled the build. The incomplete index was removed with `DROP INDEX CONCURRENTLY` and the catalog was checked to confirm it no longer exists. The original source index was not changed.

The actual bottleneck is evidenced by the post-autovacuum plan below: the planner underestimates the matching rows by about 9.8× and the query performs an ordinary heap-fetching index scan. The next safe optimization is to compare, in staging, a covering index on both the text league ID and its integer cast against an incremental league-count summary. Do not create that index in production through the short-timeout SQL API; a reviewed operator session and a representative plan comparison are required.

## Implemented in the release PR: incremental projection

The release branch now contains migration `0071_incremental_featured_injury_counts.sql`:

- Creates a private, compact `featured_injury_rows` projection containing only the 11 featured leagues.
- Adds server-side triggers for injury insert/update/delete transitions. They update the projection by `ref`, so unchanged provider rows do not rewrite it.
- Backfills the projection from the existing partial injury index with `ON CONFLICT DO NOTHING`; concurrent upserts that arrive after trigger activation keep their newer values.
- Exposes `featured_injury_counts_live` as a small grouped view over the projection.
- Updates `get_public_league_digest_source` to read the live projection for featured leagues while preserving the original fallback count for other leagues.
- Unschedules the legacy hourly materialized-view refresh, retaining the old materialized view temporarily for rollback.
- Adds a SQL contract covering source reconciliation and insert, league-change update, and delete behavior.

This is a **proposed code change in PR #132**, not yet deployed to production. The migration's trigger creation takes a short write lock on `api_football_data` while the initial 109k-row projection is backfilled (the measured source query was about 28 seconds). Schedule this migration off-peak, confirm the importer queue is idle, and monitor lock waits. Reads remain available; the lock only pauses writes to this provider cache while the migration transaction commits.

Rollback: restore `get_public_league_digest_source` to its prior materialized-view join and re-schedule the legacy cron job before removing the live projection triggers/tables. Do not drop the legacy materialized view until the new path has passed 24 hours of production verification. The migration replay and SQL contract must pass before release. After deployment, compare the live projection to the source and measure p50/p95 for the public digest RPC and its query plan. Keep the legacy materialized view until the new path has passed at least 24 hours of production verification; only then consider dropping it.

## Capture the exact production plan and blockers

```sql
SELECT pg_get_viewdef('private_performance.featured_injury_counts'::regclass, true);

SELECT
  pid, state, wait_event_type, wait_event,
  now() - query_start AS query_age,
  left(query, 500) AS query
FROM pg_stat_activity
WHERE query ILIKE '%featured_injury_counts%'
ORDER BY query_start;

SELECT
  blocked.pid AS blocked_pid,
  blocker.pid AS blocker_pid,
  now() - blocked.query_start AS blocked_for,
  left(blocked.query, 300) AS blocked_query,
  left(blocker.query, 300) AS blocker_query
FROM pg_stat_activity AS blocked
JOIN pg_locks AS blocked_lock
  ON blocked_lock.pid = blocked.pid AND NOT blocked_lock.granted
JOIN pg_locks AS blocker_lock
  ON blocker_lock.locktype = blocked_lock.locktype
 AND blocker_lock.database IS NOT DISTINCT FROM blocked_lock.database
 AND blocker_lock.relation IS NOT DISTINCT FROM blocked_lock.relation
 AND blocker_lock.page IS NOT DISTINCT FROM blocked_lock.page
 AND blocker_lock.tuple IS NOT DISTINCT FROM blocked_lock.tuple
 AND blocker_lock.virtualxid IS NOT DISTINCT FROM blocked_lock.virtualxid
 AND blocker_lock.transactionid IS NOT DISTINCT FROM blocked_lock.transactionid
 AND blocker_lock.classid IS NOT DISTINCT FROM blocked_lock.classid
 AND blocker_lock.objid IS NOT DISTINCT FROM blocked_lock.objid
 AND blocker_lock.objsubid IS NOT DISTINCT FROM blocked_lock.objsubid
 AND blocker_lock.pid <> blocked_lock.pid
JOIN pg_stat_activity AS blocker ON blocker.pid = blocker_lock.pid
WHERE blocked.query ILIKE '%featured_injury_counts%';

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'private_performance'
  AND tablename = 'featured_injury_counts';
```

In staging, run `EXPLAIN (ANALYZE, BUFFERS, WAL, SETTINGS)` on the view's defining SELECT. Do not run an expensive `EXPLAIN ANALYZE` against production during peak traffic.

## Post-autovacuum query measurement — 11 November 2026

After the successful autovacuum/autoanalyze, a read-only `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)` of the materialized-view source query returned:

- Estimated rows: 11,128
- Actual rows from the partial index scan: 109,551 (about 9.8× under-estimated)
- Shared blocks: 1,126 hits and 67,727 reads (approximately 529 MiB read)
- Execution time: 28,115 ms
- Plan: `Index Scan using api_football_injury_league_time_idx`, followed by `HashAggregate`; it was not an index-only scan.

A manual concurrent refresh after the vacuum also remained around 36 seconds. Therefore the autovacuum change succeeded, but it did **not** resolve the materialized-view refresh latency.

A candidate covering expression index on both the text league ID and its integer cast was attempted with `CREATE INDEX CONCURRENTLY`, but the database's two-minute statement timeout cancelled the build. The resulting invalid index was immediately dropped concurrently and verified absent. No invalid index remains. Do not retry this build with a longer timeout in production without a reviewed maintenance window and storage/I/O budget.

The next optimization must be validated in staging: compare a covering expression index and/or an incremental league-count summary against the current query, verify an index-only plan, and prove equivalent counts before deployment. The current source index remains unchanged.

## Remediation decision

- If blocked: fix the blocker/transaction lifetime first.
- If I/O-bound: inspect cache hit ratio, storage latency, table/index bloat and vacuum health.
- If CPU-bound: inspect the actual plan and source row count; only then consider incremental aggregation or narrower source predicates.
- Keep `REFRESH MATERIALIZED VIEW CONCURRENTLY` unless a measured maintenance window explicitly accepts read blocking.
- Align the cron schedule name and actual cadence only after product freshness requirements and the measured refresh cost are agreed.

## Acceptance criteria

Record at least 10 consecutive refresh durations, p50/p95, wait events, rows scanned, buffers read/hit, and failure count. Target p95 under 5 seconds without blocking readers, no refresh overlap, and no regression in public league/fixture queries. The current 30-second observation is a confirmed bottleneck signal, not proof of its root cause.
