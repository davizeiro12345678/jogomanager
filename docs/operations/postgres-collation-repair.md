# PostgreSQL collation-version repair — production runbook

## Incident evidence

The production database reported:

- Recorded collation version: `153.120`
- Operating-system collation version: `153.121`

This is a database-wide metadata mismatch. It is not safe to silence the warning by refreshing the recorded version before rebuilding affected indexes: text ordering and equality semantics may have changed, leaving indexes inconsistent with the active collation.

A read-only production inventory on 11 November 2026 found **251 ordinary indexes** that depend on the database-default collation. All 251 reported `indisvalid = true`, and the database had zero invalid indexes at the time of inspection. That validity flag does not prove collation-version consistency: these indexes still require rebuild before the recorded version is refreshed.

## Safety requirements

1. Schedule a maintenance window and confirm a recent recoverable backup/PITR window.
2. Record the current database name, collation versions, index inventory and application error rate.
3. Run the preflight queries below using a role allowed to inspect PostgreSQL catalogs.
4. Rebuild every affected collation-dependent index before refreshing the database version.
5. Run each `REINDEX ... CONCURRENTLY` statement individually, outside an explicit transaction. Do not wrap this runbook in a migration transaction.
6. If the provider does not permit concurrent reindexing for a particular index, schedule its non-concurrent rebuild separately; do not skip it.
7. Only after all affected indexes are valid, run the final database refresh.
8. Verify the recorded and actual versions match, then monitor query latency and application errors.

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

The production catalog query identified **244 collation-dependent ordinary indexes** across the database (the exact count is the sum of the schema rows below), representing approximately **2.17 GB** of index storage. The largest individual indexes were approximately 645 MB in `public` and 387 MB in `football_import_private`.

| Schema | Indexes | Approximate total |
|---|---:|---:|
| `public` | 111 | 1,222 MB |
| `football_import_private` | 3 | 947 MB |
| `stripe` | 60 | 1.3 MB |
| `backup_restore` | 1 | 1.1 MB |
| `auth` | 34 | 440 kB |
| `storage` | 21 | 176 kB |
| Remaining schemas | 14 | under 200 kB combined |

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
