CREATE TABLE public.player_honours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'thesportsdb',
  source_id text NOT NULL UNIQUE,
  honour text NOT NULL,
  team_name text,
  season text,
  trophy_url text,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX player_honours_player_idx ON public.player_honours(player_id);
GRANT SELECT ON public.player_honours TO anon, authenticated;
GRANT ALL ON public.player_honours TO service_role;
ALTER TABLE public.player_honours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read player honours" ON public.player_honours FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.player_career_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'thesportsdb',
  source_id text NOT NULL UNIQUE,
  team_name text NOT NULL,
  move_type text,
  joined text,
  departed text,
  appearances integer CHECK (appearances IS NULL OR appearances >= 0),
  goals integer CHECK (goals IS NULL OR goals >= 0),
  badge_url text,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX player_career_clubs_player_idx ON public.player_career_clubs(player_id);
GRANT SELECT ON public.player_career_clubs TO anon, authenticated;
GRANT ALL ON public.player_career_clubs TO service_role;
ALTER TABLE public.player_career_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read player career clubs" ON public.player_career_clubs FOR SELECT TO anon, authenticated USING (true);