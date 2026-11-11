# PostgreSQL collation-version repair — production runbook

## Incident evidence

The production database reported:

- Recorded collation version: `153.120`
- Operating-system collation version: `153.121`

This is a database-wide metadata mismatch. It is not safe to silence the warning by refreshing the recorded version before rebuilding affected indexes: text ordering and equality semantics may have changed, leaving indexes inconsistent with the active collation.

A read-only production inventory on 11 November 2026 found **251 ordinary indexes** whose key collations resolve to the database-default collation, totaling **2,172.20 MiB (about 2.12 GiB)**. All 251 reported `indisvalid = true` and `indisready = true` at inspection. The separate invalid API-Football injury covering index is not part of this collation-dependent set. Index validity does not prove collation-version consistency: these 251 indexes still require rebuild before the recorded version is refreshed.

## Production inventory observed on 11 November 2026

The production database still reports recorded collation `153.120` versus actual `153.121`. A read-only catalog inventory found:

- 197 ordinary indexes (`pg_class.relkind = 'i'`) using the database-default collation, totaling approximately 2,173 MB.
- One partitioned index (`relkind = 'I'`); its parent has no physical size, and its child indexes must be inventoried and rebuilt as required.
- The ordinary-index inventory spans application and extension-managed schemas, not just `public`.

This is a database-wide maintenance task, not a single-index patch. Rebuilding all affected indexes concurrently can temporarily require substantial additional disk space and I/O. Before proceeding, calculate the exact child-index inventory, identify extension-owned objects, verify provider permissions and available storage, and agree on a monitored maintenance window. Do not execute a blanket reindex from an application migration or during normal release deployment.

## Safety requirements

1. Schedule a maintenance window and confirm a recent recoverable backup/PITR window.
2. Record the current database name, collation versions, index inventory and application error rate.
3. Run the preflight queries below using a role allowed to inspect PostgreSQL catalogs.
4. Rebuild every affected collation-dependent index before refreshing the database version.
5. Run each `REINDEX ... CONCURRENTLY` statement individually, outside an explicit transaction. Do not wrap this runbook in a migration transaction.
6. If the provider does not permit concurrent reindexing for a particular index, schedule its non-concurrent rebuild separately; do not skip it.
7. Only after all affected indexes are valid, run the final database refresh.
8. Verify the recorded and actual versions match, then monitor query latency and application errors.

## Production scope observed

The exact inventory is **251 ordinary indexes plus one partitioned parent index** (`realtime.messages_replay_index`). That parent has six physical child indexes in the current partition set; all six were valid at inspection. The other partitioned parent index, `realtime.messages_pkey`, does not use the database-default collation and is not included in this repair set.

The 251 ordinary indexes span `auth`, `auth_safety`, `backup_restore`, `cron`, `data_quality`, `extensions`, `football_import_private`, `oracle_bridge_private`, `pgmq`, `public`, `realtime`, `storage`, `stripe`, `supabase_functions`, `supabase_migrations`, and `vault`. Four ordinary indexes exceed 100 MB; the largest is approximately 645 MB. The inventory query below is the source of truth; rerun it immediately before maintenance because partition membership and index sizes can change.

The maintenance window must therefore be sized from the generated inventory, actual I/O headroom and replica lag. Preserve the inventory output, process ordinary indexes one at a time, rebuild each affected child of `messages_replay_index` as required, and pause if query latency, lock waits, storage latency or replication lag exceed the agreed limits. Do not blindly run a database-wide reindex during peak traffic.

## Preflight: confirm the mismatch

```sql
SELECT
  datname,
  datcollversion AS recorded_version,
  pg_database_collation_actual_version(oid) AS actual_version,
  datcollversion = pg_database_collation_actual_version(oid) AS in_sync
FROM pg_database
WHERE datname = current_database();
```

## Inventory affected indexes

This query lists ordinary indexes whose key columns use the database-default collation. Review the output and preserve it with the change record.

```sql
SELECT
  ns.nspname AS schema_name,
  idx.relname AS index_name,
  tbl.relname AS table_name,
  i.indisvalid AS is_valid,
  pg_size_pretty(pg_relation_size(idx.oid)) AS index_size,
  format('REINDEX INDEX CONCURRENTLY %I.%I;', ns.nspname, idx.relname) AS repair_command
FROM pg_index AS i
JOIN pg_class AS idx ON idx.oid = i.indexrelid
JOIN pg_namespace AS ns ON ns.oid = idx.relnamespace
JOIN pg_class AS tbl ON tbl.oid = i.indrelid
WHERE idx.relkind = 'i'
  AND EXISTS (
    SELECT 1
    FROM unnest(i.indcollation) AS key_collation(oid)
    JOIN pg_collation AS coll ON coll.oid = key_collation.oid
    WHERE coll.collname = 'default'
  )
ORDER BY ns.nspname, tbl.relname, idx.relname;
```

Partitioned indexes (`pg_class.relkind = 'I'`) must be reviewed separately with their child indexes. Do not assume the ordinary-index command list covers them.

## Production inventory captured on 11 November 2026

The production catalog query identified **251 collation-dependent ordinary indexes** across the database (the exact count is the sum of the schema rows below), representing approximately **2.17 GB** of index storage. The largest individual indexes were approximately 645 MB in `public` and 387 MB in `football_import_private`.

| Schema | Indexes | Approximate total |
|---|---:|---:|
| `public` | 111 | 1,222 MB |
| `football_import_private` | 3 | 947 MB |
| `stripe` | 60 | 1.3 MB |
| `backup_restore` | 1 | 1.1 MB |
| `auth` | 34 | 440 kB |
| `storage` | 21 | 176 kB |
| Remaining schemas | 21 | approximately 296 kB combined |

There is also a partitioned index `realtime.messages_replay_index`. It must be handled through its child indexes/provider-supported procedure; do not run a concurrent reindex against the partitioned parent.

This inventory changes the operational decision: the rebuild is not a one-index operation. Before starting, confirm at least 2.5–3 GB of free storage headroom (more if index growth is expected), WAL/replication capacity, and the Supabase maintenance policy. The provider-managed schemas (`auth`, `storage`, `realtime`, `stripe`, and others) should be coordinated with Supabase if the project role cannot safely rebuild them. Do not refresh the database collation version until the complete affected-index inventory is reconciled and rebuilt.

## Rebuild

Run the generated `REINDEX INDEX CONCURRENTLY schema.index;` commands one at a time, outside a transaction. Keep application traffic monitored. Stop if lock waits, replication lag, CPU, I/O or error rates breach the maintenance limits agreed for the window.

## Refresh the database's recorded version — last step only

After every affected index has been rebuilt and verified:

```sql
ALTER DATABASE postgres REFRESH COLLATION VERSION;
```

Run this against the actual production database name if it is not `postgres`, with the database owner/provider-supported role. This command updates metadata; it does not rebuild indexes.

## Postflight

```sql
SELECT
  datname,
  datcollversion AS recorded_version,
  pg_database_collation_actual_version(oid) AS actual_version,
  datcollversion = pg_database_collation_actual_version(oid) AS in_sync
FROM pg_database
WHERE datname = current_database();

SELECT
  ns.nspname AS schema_name,
  idx.relname AS invalid_index
FROM pg_index AS i
JOIN pg_class AS idx ON idx.oid = i.indexrelid
JOIN pg_namespace AS ns ON ns.oid = idx.relnamespace
WHERE NOT i.indisvalid
ORDER BY ns.nspname, idx.relname;
```

Expected outcome: the version check returns `in_sync = true`, no affected index remains invalid, and application query/error metrics return to baseline.

## Why this is not an automatic application migration

A blanket reindex can hold locks and consume substantial I/O on a production database. The repair is deliberately an operator-run maintenance procedure with preflight, index inventory, rollback/PITR readiness and postflight verification. The migration pipeline must not merely execute `ALTER DATABASE ... REFRESH COLLATION VERSION` and conceal the underlying index-rebuild requirement.
