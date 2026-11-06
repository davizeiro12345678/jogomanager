CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS players_playable_name_trgm_idx ON public.players USING gin (name extensions.gin_trgm_ops) WHERE source_kind = 'player' AND canonical_player_id IS NULL;
CREATE INDEX IF NOT EXISTS api_football_data_kind_ref_prefix_idx ON public.api_football_data (kind, ref text_pattern_ops);