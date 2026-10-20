-- Explicit transaction for Supabase CLI replay.
-- Recorded SQL: supabase/migration-archive/recorded/20261019185140_index_player_name_search_and_squad_cursor.sql
BEGIN;

-- Measured ILIKE '%name%' market search previously scanned all 201k players.
-- Bounded lock/statement waits keep the change abortable on a busy importer.
set local lock_timeout = '3s';
set local statement_timeout = '90s';
create extension if not exists pg_trgm with schema extensions;
create index if not exists players_name_search_trgm_idx on public.players using gin (name extensions.gin_trgm_ops);
-- The squad uses club equality followed by a stable UUID keyset cursor.
create index if not exists players_club_cursor_idx on public.players (club_id, id);
analyze public.players;

COMMIT;
