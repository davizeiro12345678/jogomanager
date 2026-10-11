CREATE INDEX IF NOT EXISTS api_football_data_league_id_idx ON public.api_football_data (kind, ((payload->'league'->>'id')));
CREATE INDEX IF NOT EXISTS api_football_data_team_name_idx ON public.api_football_data (kind, ((payload->'team'->>'name')));
CREATE INDEX IF NOT EXISTS official_events_source_status_idx ON public.official_events (source_id text_pattern_ops, status);