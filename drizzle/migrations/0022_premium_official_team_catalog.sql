CREATE TABLE public.official_teams (
  source_id text PRIMARY KEY,
  league_source_id text,
  name text NOT NULL,
  venue_source_id text,
  local_club_id text REFERENCES public.clubs(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.official_teams TO anon, authenticated;
GRANT ALL ON public.official_teams TO service_role;
ALTER TABLE public.official_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Official teams are public" ON public.official_teams FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX official_teams_league_idx ON public.official_teams(league_source_id);
