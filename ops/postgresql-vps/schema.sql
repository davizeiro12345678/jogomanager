-- Disposable, public-catalog-only cache. Supabase is authoritative.
CREATE SCHEMA IF NOT EXISTS jm_cache;
REVOKE ALL ON SCHEMA jm_cache FROM PUBLIC;

CREATE TABLE IF NOT EXISTS jm_cache.catalog_entries (
  kind text NOT NULL CHECK (kind IN ('competitions', 'clubs', 'players', 'stadiums', 'kits', 'competition_seasons', 'official_teams', 'official_venues', 'official_players')),
  id text NOT NULL,
  payload jsonb NOT NULL,
  source_updated_at timestamptz,
  cached_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (kind, id)
);
CREATE INDEX IF NOT EXISTS jm_catalog_entries_updated_idx
  ON jm_cache.catalog_entries (kind, source_updated_at DESC);

CREATE TABLE IF NOT EXISTS jm_cache.sync_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('competitions', 'clubs', 'players', 'stadiums', 'kits', 'competition_seasons', 'official_teams', 'official_venues', 'official_players')),
  row_count integer NOT NULL CHECK (row_count >= 0),
  finished_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

DO $role$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jmsbapi') THEN
    CREATE ROLE jmsbapi LOGIN;
  END IF;
END $role$;
GRANT CONNECT ON DATABASE jogomanager_local TO jmsbapi;
GRANT USAGE ON SCHEMA jm_cache TO jmsbapi;
GRANT SELECT ON jm_cache.catalog_entries, jm_cache.sync_runs TO jmsbapi;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON jm_cache.catalog_entries, jm_cache.sync_runs FROM jmsbapi;
