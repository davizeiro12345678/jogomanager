# PostgreSQL performance investigation — featured injury counts

## Observed production signal

A production `pg_stat_statements` sample showed 26 calls to:

`REFRESH MATERIALIZED VIEW CONCURRENTLY private_performance.featured_injury_counts`

with approximately 30.6 seconds mean execution time and 32.3 seconds maximum. The scheduled job is named `jm_refresh_featured_injury_counts_15m`, but the observed cron schedule was hourly (`0 * * * *`). The materialized view is small (about 32 kB) and has one index; the source table has a partial index for injury league/time lookups.

Do not change the schedule or replace the concurrent refresh with a blocking refresh until the cause is established. The view may be waiting on locks or I/O rather than spending 30 seconds aggregating rows.

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

## Remediation decision

- If blocked: fix the blocker/transaction lifetime first.
- If I/O-bound: inspect cache hit ratio, storage latency, table/index bloat and vacuum health.
- If CPU-bound: inspect the actual plan and source row count; only then consider incremental aggregation or narrower source predicates.
- Keep `REFRESH MATERIALIZED VIEW CONCURRENTLY` unless a measured maintenance window explicitly accepts read blocking.
- Align the cron schedule name and actual cadence only after product freshness requirements and the measured refresh cost are agreed.

## Acceptance criteria

Record at least 10 consecutive refresh durations, p50/p95, wait events, rows scanned, buffers read/hit, and failure count. Target p95 under 5 seconds without blocking readers, no refresh overlap, and no regression in public league/fixture queries. The current 30-second observation is a confirmed bottleneck signal, not proof of its root cause.
