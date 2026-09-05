-- ============ competitions ============
CREATE TABLE public.competitions (
  id text PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL,
  flag text,
  tier smallint NOT NULL DEFAULT 1,
  club_count smallint NOT NULL DEFAULT 20,
  logo_url text,
  external_source text,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.competitions TO anon, authenticated;
GRANT ALL ON public.competitions TO service_role;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Competitions are public" ON public.competitions FOR SELECT USING (true);

-- ============ stadiums ============
CREATE TABLE public.stadiums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  country text,
  capacity integer,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stadiums TO anon, authenticated;
GRANT ALL ON public.stadiums TO service_role;
ALTER TABLE public.stadiums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stadiums are public" ON public.stadiums FOR SELECT USING (true);

-- ============ clubs ============
CREATE TABLE public.clubs (
  id text PRIMARY KEY,
  competition_id text REFERENCES public.competitions(id) ON DELETE SET NULL,
  name text NOT NULL,
  short_name text NOT NULL,
  full_name text,
  city text,
  country text,
  founded smallint,
  primary_color text NOT NULL DEFAULT '#0a8f3c',
  secondary_color text NOT NULL DEFAULT '#ffffff',
  strength smallint NOT NULL DEFAULT 70,
  crest_url text,
  stadium_id uuid REFERENCES public.stadiums(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clubs_competition_idx ON public.clubs(competition_id);
GRANT SELECT ON public.clubs TO anon, authenticated;
GRANT ALL ON public.clubs TO service_role;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clubs are public" ON public.clubs FOR SELECT USING (true);

-- ============ kits ============
CREATE TABLE public.kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id text NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  season text NOT NULL DEFAULT '2025-2026',
  kind text NOT NULL DEFAULT 'home',
  pattern text NOT NULL DEFAULT 'solid',
  base_color text NOT NULL DEFAULT '#ffffff',
  detail_color text NOT NULL DEFAULT '#111111',
  shorts_color text NOT NULL DEFAULT '#ffffff',
  socks_color text NOT NULL DEFAULT '#ffffff',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, season, kind)
);
CREATE INDEX kits_club_idx ON public.kits(club_id);
GRANT SELECT ON public.kits TO anon, authenticated;
GRANT ALL ON public.kits TO service_role;
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kits are public" ON public.kits FOR SELECT USING (true);

-- ============ players ============
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id text NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  position text NOT NULL,
  age smallint NOT NULL DEFAULT 24,
  shirt_number smallint,
  nationality text,
  overall smallint NOT NULL DEFAULT 70,
  potential smallint,
  photo_url text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX players_club_idx ON public.players(club_id);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players are public" ON public.players FOR SELECT USING (true);

-- ============ club_external_ids ============
CREATE TABLE public.club_external_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id text NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  source text NOT NULL,
  external_id text NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id),
  UNIQUE (club_id, source)
);
GRANT SELECT ON public.club_external_ids TO anon, authenticated;
GRANT ALL ON public.club_external_ids TO service_role;
ALTER TABLE public.club_external_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club external ids are public" ON public.club_external_ids FOR SELECT USING (true);

-- ============ import_runs ============
CREATE TABLE public.import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  scope text,
  status text NOT NULL DEFAULT 'running',
  items_imported integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.import_runs TO anon, authenticated;
GRANT ALL ON public.import_runs TO service_role;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Import runs are public" ON public.import_runs FOR SELECT USING (true);

-- ============ updated_at triggers ============
CREATE TRIGGER update_competitions_updated_at BEFORE UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stadiums_updated_at BEFORE UPDATE ON public.stadiums
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_kits_updated_at BEFORE UPDATE ON public.kits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_club_external_ids_updated_at BEFORE UPDATE ON public.club_external_ids
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_import_runs_updated_at BEFORE UPDATE ON public.import_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();