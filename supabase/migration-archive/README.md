# Historical SQL retained for reference

Supabase Branching replays only `supabase/migrations/*.sql`. This archive must not be replayed alongside that directory.

The production project was created with `20261002165848_jogomanager_initial_backend`: it already combines the original August/September Supabase files and the then-current Drizzle files. Subsequent production restores also combined several repository migrations under their actual deployment timestamps. Keeping both histories in the active folder tried to build an incomplete schema and failed at `players.source_id`.

On 20 October 2026, the 47 SQL entries recorded in the production project's migration history were retrieved using a read-only query. Their versions and normalized SHA256 digests are recorded in `../migration-history.json`. No account, career, purchase, or provider credential was exported. These files preserve the previous repository versions byte for byte; `format-only` retains one formatting-only variant of an already recorded migration.

The forward migration `20261020101601_restore_missing_security_contracts.sql` retains the intended coupon verification and allocation checks, public ranking column grants, and self-owned telemetry/hour quota that were present in Git but absent from the applied production definitions. Its coupon implementation remains in `app_private`; the public RPC stays a `SECURITY INVOKER` wrapper.

Future schema changes belong in new timestamped files in `supabase/migrations`. Do not concatenate this archive or the Drizzle directory after the canonical baseline, and do not replay the empty-project baseline against an existing production database.
