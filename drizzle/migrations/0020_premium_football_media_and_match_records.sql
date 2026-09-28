CREATE TABLE public.official_media (
  source text NOT NULL DEFAULT 'thesportsdb',
  entity_type text NOT NULL,
  source_id text NOT NULL,
  kind text NOT NULL,
  url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, entity_type, source_id, kind)
);
GRANT SELECT ON public.official_media TO anon, authenticated;
GRANT ALL ON public.official_media TO service_role;
ALTER TABLE public.official_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Official media is public" ON public.official_media FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.official_events (
  source_id text PRIMARY KEY,
  league_source_id text NOT NULL,
  season text NOT NULL,
  home_team_source_id text,
  away_team_source_id text,
  home_team_name text,
  away_team_name text,
  starts_at timestamptz,
  home_score integer,
  away_score integer,
  status text,
  venue_source_id text,
  venue_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.official_events TO anon, authenticated;
GRANT ALL ON public.official_events TO service_role;
ALTER TABLE public.official_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Official events are public" ON public.official_events FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX official_events_league_season_idx ON public.official_events(league_source_id, season);

CREATE TABLE public.official_event_details (
  event_source_id text NOT NULL REFERENCES public.official_events(source_id) ON DELETE CASCADE,
  detail_type text NOT NULL,
  source_id text NOT NULL,
  team_source_id text,
  player_source_id text,
  minute integer,
  label text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_source_id, detail_type, source_id)
);
GRANT SELECT ON public.official_event_details TO anon, authenticated;
GRANT ALL ON public.official_event_details TO service_role;
ALTER TABLE public.official_event_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Official event details are public" ON public.official_event_details FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX official_event_details_event_idx ON public.official_event_details(event_source_id);

CREATE UNIQUE INDEX stadiums_thesportsdb_source_id_idx ON public.stadiums(source_id) WHERE source_id IS NOT NULL;
