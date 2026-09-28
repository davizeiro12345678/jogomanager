CREATE TABLE public.official_leagues (
  source_id text PRIMARY KEY,
  name text NOT NULL,
  sport text NOT NULL,
  country text,
  current_season text,
  local_competition_id text REFERENCES public.competitions(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.official_leagues TO anon, authenticated;
GRANT ALL ON public.official_leagues TO service_role;
ALTER TABLE public.official_leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Official leagues are public" ON public.official_leagues FOR SELECT TO anon, authenticated USING (true);
