# Canonical migration history

This directory follows the versions actually recorded by project `lguqnwvsfeefxamzeyos`, recovered on 20 October 2026. The baseline already includes the original Supabase and Drizzle schema. The provenance manifest and preserved old files are in `../migration-history.json` and `../migration-archive/`.

## Explicit transaction blocks for PostgreSQL 17

The first native Supabase CLI 2.75.2 replay on PostgreSQL 17.6.1.079 failed with `25P01` at the `LOCK TABLE` in `20261002202837`. The CLI batches statements without an explicit `BEGIN`; an implicit batch transaction does not satisfy this PostgreSQL 17 command requirement. Eleven other recorded migrations use `SET LOCAL`, which also needs an explicit transaction block.

Those 12 files now add only an explicit `BEGIN`/`COMMIT` envelope around the original normalized SQL. The remaining historical files retain their recorded execution form, including the existing explicit transaction. No lock, statement, grant, timeout, or version was removed. The exact recorded bytes of all 47 historical definitions, including their original line endings, are preserved in `../migration-archive/recorded/`.

The manifest retains `normalizedSha256` for the recorded SQL and separately records the raw archive hash, replay mode, and replay hash. The verifier accepts only the documented envelope transformation around that same recorded body; arbitrary historical edits still fail validation. `.gitattributes` prevents line-ending conversion in the raw archive.

The CLI inserts its migration-history record after the file's statements. For an explicitly committed file, history registration therefore follows the DDL commit. If execution is interrupted between these steps, inspect both schema and migration history before retrying; do not blindly replay non-idempotent statements or mark an unverified migration as applied. Envelopes are limited to the 12 files that require them to minimize this change.

PGlite/PostgreSQL 18 validation is auxiliary. PostgreSQL 18 changed its handling of implicit transaction blocks in extended-protocol pipelines; it can accept a lock sequence that PostgreSQL 17 rejects. A passing PGlite replay does not replace the native PostgreSQL 17 CI gate.

Validation:

```sh
node scripts/verify-migration-history.mjs
supabase db start
supabase db reset --local --no-seed --yes
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f tests/sql/supabase-replay-contract.sql
```

The reset command above is strictly for a disposable local database. CI uses the same local path without production credentials. Never pass `--linked` or a production connection string to a reset command.

The previously failed PR55 preview had replayed an unrelated, partial history. After publishing this correction, that empty development branch needs a managed reset/recreation and successful replay before its integration check can be considered fixed. A green local test does not certify the hosted preview or Cloudflare deployment.

Only a new forward migration is eligible to run against an existing production database. The 47 historical versions are already applied there and must not be rerun or marked as new.
