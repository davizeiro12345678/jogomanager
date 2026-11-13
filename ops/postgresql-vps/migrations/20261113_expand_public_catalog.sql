-- Apply ONLY to VPS database jogomanager_local. Do not change Supabase production.
-- Controlled extension of the existing disposable, public-only catalog mirror.
BEGIN;
ALTER TABLE jm_cache.catalog_entries
  DROP CONSTRAINT IF EXISTS catalog_entries_kind_check;
ALTER TABLE jm_cache.catalog_entries
  ADD CONSTRAINT catalog_entries_kind_check CHECK (kind IN ('competitions', 'clubs', 'players', 'stadiums', 'kits', 'competition_seasons', 'official_teams', 'official_venues', 'official_players'));
ALTER TABLE jm_cache.sync_runs
  DROP CONSTRAINT IF EXISTS sync_runs_kind_check;
ALTER TABLE jm_cache.sync_runs
  ADD CONSTRAINT sync_runs_kind_check CHECK (kind IN ('competitions', 'clubs', 'players', 'stadiums', 'kits', 'competition_seasons', 'official_teams', 'official_venues', 'official_players'));
COMMIT;
