# PostgreSQL collation-version repair — production runbook

## Incident evidence

The production database reported:

- Recorded collation version: `153.120`
- Operating-system collation version: `153.121`

This is a database-wide metadata mismatch. It is not safe to silence the warning by refreshing the recorded version before rebuilding affected indexes: text ordering and equality semantics may have changed, leaving indexes inconsistent with the active collation.

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
