DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clubs','players','competitions','stadiums','club_honours','kits'] LOOP
    EXECUTE format('ALTER TABLE public.%I
      ADD COLUMN IF NOT EXISTS source_id text,
      ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
      ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
      ADD COLUMN IF NOT EXISTS data_version integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT ''pending''', t);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_sync_status_chk');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (sync_status IN (''pending'',''synced'',''stale'',''failed'',''manual''))', t, t || '_sync_status_chk');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (sync_status, last_synced_at)', t || '_sync_idx', t);
  END LOOP;
END $$;

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'league',
  ADD COLUMN IF NOT EXISTS confederation text,
  ADD COLUMN IF NOT EXISTS format text;
ALTER TABLE public.competitions DROP CONSTRAINT IF EXISTS competitions_kind_chk;
ALTER TABLE public.competitions ADD CONSTRAINT competitions_kind_chk
  CHECK (kind IN ('league','national_cup','super_cup','state','continental','intercontinental','club_world_cup'));

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS height_cm smallint,
  ADD COLUMN IF NOT EXISTS preferred_foot text,
  ADD COLUMN IF NOT EXISTS overall_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS players_source_uidx ON public.players (source, source_id) WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clubs_source_uidx ON public.clubs (data_source, source_id) WHERE source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.competition_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id text NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  season text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','finished','cancelled')),
  champion_club_id text REFERENCES public.clubs(id) ON DELETE SET NULL,
  runner_up_club_id text REFERENCES public.clubs(id) ON DELETE SET NULL,
  starts_on date,
  ends_on date,
  source_id text,
  source_updated_at timestamptz,
  last_synced_at timestamptz,
  data_version integer NOT NULL DEFAULT 1,
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','stale','failed','manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, season)
);
GRANT SELECT ON public.competition_seasons TO anon, authenticated;
GRANT ALL ON public.competition_seasons TO service_role;
ALTER TABLE public.competition_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catalogo publico de temporadas" ON public.competition_seasons FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.validate_competition_season()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'finished' AND NEW.champion_club_id IS NULL THEN
    RAISE EXCEPTION 'Temporada encerrada sem campeão (%/%)', NEW.competition_id, NEW.season;
  END IF;
  IF NEW.status IN ('scheduled','cancelled') AND NEW.champion_club_id IS NOT NULL THEN
    RAISE EXCEPTION 'Temporada não disputada não pode ter campeão';
  END IF;
  IF NEW.champion_club_id IS NOT NULL AND NEW.champion_club_id = NEW.runner_up_club_id THEN
    RAISE EXCEPTION 'Campeão e vice não podem ser o mesmo clube';
  END IF;
  IF NEW.starts_on IS NOT NULL AND NEW.ends_on IS NOT NULL AND NEW.ends_on < NEW.starts_on THEN
    RAISE EXCEPTION 'Data final anterior à inicial';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER competition_seasons_validate BEFORE INSERT OR UPDATE ON public.competition_seasons
  FOR EACH ROW EXECUTE FUNCTION public.validate_competition_season();

CREATE TABLE IF NOT EXISTS public.player_season_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  club_id text REFERENCES public.clubs(id) ON DELETE SET NULL,
  competition_id text REFERENCES public.competitions(id) ON DELETE SET NULL,
  season text NOT NULL,
  appearances smallint NOT NULL DEFAULT 0 CHECK (appearances >= 0),
  starts smallint NOT NULL DEFAULT 0 CHECK (starts >= 0),
  minutes integer NOT NULL DEFAULT 0 CHECK (minutes >= 0),
  goals smallint NOT NULL DEFAULT 0 CHECK (goals >= 0),
  assists smallint NOT NULL DEFAULT 0 CHECK (assists >= 0),
  yellow_cards smallint NOT NULL DEFAULT 0 CHECK (yellow_cards >= 0),
  red_cards smallint NOT NULL DEFAULT 0 CHECK (red_cards >= 0),
  clean_sheets smallint NOT NULL DEFAULT 0 CHECK (clean_sheets >= 0),
  rating numeric(4,2) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
  source text,
  source_id text,
  source_updated_at timestamptz,
  last_synced_at timestamptz,
  data_version integer NOT NULL DEFAULT 1,
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','stale','failed','manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts <= appearances)
);
CREATE UNIQUE INDEX IF NOT EXISTS player_season_stats_uidx
  ON public.player_season_stats (player_id, season, coalesce(competition_id, ''));
GRANT SELECT ON public.player_season_stats TO anon, authenticated;
GRANT ALL ON public.player_season_stats TO service_role;
ALTER TABLE public.player_season_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catalogo publico de estatisticas" ON public.player_season_stats FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER player_season_stats_updated BEFORE UPDATE ON public.player_season_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.tech_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fps_avg numeric(5,1) CHECK (fps_avg IS NULL OR (fps_avg >= 0 AND fps_avg <= 1000)),
  frame_time_p95_ms numeric(7,2) CHECK (frame_time_p95_ms IS NULL OR (frame_time_p95_ms >= 0 AND frame_time_p95_ms <= 10000)),
  browser text CHECK (browser IS NULL OR length(browser) <= 32),
  gpu_tier smallint CHECK (gpu_tier IS NULL OR gpu_tier BETWEEN 0 AND 3),
  graphics_preset text CHECK (graphics_preset IS NULL OR graphics_preset IN ('baixa','media','alta','auto')),
  load_time_ms integer CHECK (load_time_ms IS NULL OR (load_time_ms >= 0 AND load_time_ms <= 600000)),
  error_code text CHECK (error_code IS NULL OR length(error_code) <= 64),
  app_version text CHECK (app_version IS NULL OR length(app_version) <= 32),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tech_telemetry TO service_role;
ALTER TABLE public.tech_telemetry ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS tech_telemetry_created_idx ON public.tech_telemetry (created_at);