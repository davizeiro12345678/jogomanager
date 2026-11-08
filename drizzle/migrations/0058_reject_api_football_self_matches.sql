-- Reject new or modified API-Football self-matches without scanning the
-- historical table or discarding existing provider records.
ALTER TABLE public.official_events
  ADD CONSTRAINT official_events_api_football_distinct_teams
  CHECK (source_id NOT LIKE 'af:%' OR home_team_source_id <> away_team_source_id)
  NOT VALID;
