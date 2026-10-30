CREATE TABLE IF NOT EXISTS public.api_football_season_coverage (
  league_source_id text NOT NULL,
  season text NOT NULL,
  coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_source_id, season)
);
ALTER TABLE public.api_football_season_coverage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_football_season_coverage FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.api_football_season_coverage TO service_role;

CREATE OR REPLACE FUNCTION public.list_api_football_league_targets(p_offset integer, p_limit integer)
RETURNS TABLE(source_id text, current_season text, local_competition_id text, country text, coverage jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT l.source_id, l.current_season, l.local_competition_id, l.country, c.coverage
  FROM public.official_leagues AS l
  LEFT JOIN public.api_football_season_coverage AS c
    ON c.league_source_id=l.source_id AND c.season=l.current_season
  WHERE l.source_id LIKE 'af:%'
  ORDER BY
    coalesce(array_position(ARRAY[
      'af:71','af:72','af:39','af:140','af:135','af:78','af:61',
      'af:2','af:13','af:3','af:848','af:94','af:88'
    ]::text[], l.source_id), 10000),
    l.source_id
  OFFSET greatest(p_offset,0) LIMIT least(greatest(p_limit,1),50);
$$;
REVOKE ALL ON FUNCTION public.list_api_football_league_targets(integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_api_football_league_targets(integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.list_api_football_team_targets(p_offset integer, p_limit integer, p_squads_only boolean DEFAULT false)
RETURNS TABLE(source_id text, league_source_id text, local_club_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT t.source_id, t.league_source_id, t.local_club_id
  FROM public.official_teams AS t
  WHERE t.source_id LIKE 'af:%'
    AND (NOT p_squads_only OR t.local_club_id IS NOT NULL)
  ORDER BY
    coalesce(array_position(ARRAY[
      'af:71','af:72','af:39','af:140','af:135','af:78','af:61',
      'af:2','af:13','af:3','af:848','af:94','af:88'
    ]::text[], t.league_source_id), 10000),
    t.source_id
  OFFSET greatest(p_offset,0) LIMIT least(greatest(p_limit,1),50);
$$;
REVOKE ALL ON FUNCTION public.list_api_football_team_targets(integer,integer,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_api_football_team_targets(integer,integer,boolean) TO service_role;

CREATE INDEX IF NOT EXISTS api_football_official_teams_league_idx
  ON public.official_teams (league_source_id, source_id)
  WHERE source_id LIKE 'af:%';

CREATE TABLE IF NOT EXISTS public.api_football_page_progress (
  phase text NOT NULL CHECK (phase IN ('stats')),
  target_id text NOT NULL,
  season text NOT NULL,
  next_page integer NOT NULL DEFAULT 1 CHECK (next_page > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (phase,target_id,season)
);
ALTER TABLE public.api_football_page_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_football_page_progress FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.api_football_page_progress TO service_role;

ALTER TABLE public.api_football_import_progress
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0
  CHECK (consecutive_failures >= 0);

NOTIFY pgrst, 'reload schema';