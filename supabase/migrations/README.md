# Canonical migration history

This directory follows the versions actually recorded by project `lguqnwvsfeefxamzeyos`, recovered on 20 October 2026. The baseline already includes the original Supabase and Drizzle schema. The provenance manifest and preserved old files are in `../migration-history.json` and `../migration-archive/`.

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
