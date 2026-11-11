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

## Confirmed production root cause: invalid covering index

A direct read-only catalog inspection on 11 November 2026 confirmed:

- `api_football_injury_league_cover_idx` exists but `indisvalid = false` while `indisready = true` and `indislive = true`; its physical size is 1,304 kB. It is present and maintained for writes, but PostgreSQL excludes it from query plans because it is not valid.
- Its intended key expressions exactly cover the injury view's league filter and grouping.
- PostgreSQL therefore cannot use it. The observed refresh falls back to `api_football_injury_league_time_idx`, an ordinary index scan that fetched 3,176,979 heap tuples cumulatively in the sampled statistics.
- The existing `api_football_injury_league_time_idx` is valid (about 1.9 MiB), and the materialized view's unique index is valid. The failed covering index is the concrete index-level defect.

### Controlled repair (non-transactional; run one statement at a time)

The following operations must be run by an operator during a monitored maintenance window, after confirming backup/PITR. `CONCURRENTLY` cannot run inside a transaction; do not place these statements in a transactional migration.

```sql
DROP INDEX CONCURRENTLY IF EXISTS public.api_football_injury_league_cover_idx;
```

Then create the intended covering partial index:

```sql
CREATE INDEX CONCURRENTLY api_football_injury_league_cover_idx
ON public.api_football_data
USING btree (
  ((payload -> 'league' ->> 'id')),
  (((payload -> 'league' ->> 'id')::integer))
)
WHERE kind = 'injury';
```

After creation, refresh planner statistics and visibility information in the approved window:

```sql
ANALYZE public.api_football_data;
VACUUM (ANALYZE) public.api_football_data;
```

Do not run `VACUUM FULL`; it rewrites the 14 GB table and requires a much more disruptive lock.

### Verify the repair

```sql
SELECT
  idx.relname,
  i.indisvalid,
  i.indisready,
  pg_size_pretty(pg_relation_size(idx.oid)) AS index_size,
  pg_get_indexdef(i.indexrelid) AS definition
FROM pg_index AS i
JOIN pg_class AS idx ON idx.oid = i.indexrelid
WHERE idx.relname = 'api_football_injury_league_cover_idx';
```

Expected: `indisvalid = true`, `indisready = true`, and non-zero index size.

Then run `EXPLAIN (ANALYZE, BUFFERS)` against the view's defining SELECT in a controlled window (or a production clone). The expected plan is an index-only scan using the covering index where the visibility map permits, with substantially fewer heap fetches. Keep the existing concurrent materialized-view refresh and compare at least 10 subsequent runs.

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
