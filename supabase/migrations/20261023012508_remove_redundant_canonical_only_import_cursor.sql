set lock_timeout='2s';
set statement_timeout='30s';
-- Historical ingestion keeps every stable API-Football player ID, including
-- aliases hidden by the game. EXPLAIN uses the existing players_source_uidx;
-- the canonical-only index added in this upgrade is unused and redundant.
drop index public.players_api_import_cursor_idx;
