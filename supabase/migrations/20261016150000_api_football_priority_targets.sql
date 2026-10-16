-- API-Football: prioritize real league-season targets server-side.
-- These functions do not trigger imports; only service_role can request pages.
CREATE OR REPLACE FUNCTION public.list_api_football_league_targets(
  p_offset integer, p_limit integer
)
RETURNS TABLE(source_id text, current_season text, local_competition_id text, country text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT l.source_id, l.current_season, l.local_competition_id, l.country
  FROM public.official_leagues AS l
  WHERE l.source_id LIKE 'af:%'
  ORDER BY
    coalesce(array_position(ARRAY[
      'af:71','af:72','af:39','af:140','af:135','af:78','af:61',
      'af:2','af:13','af:3','af:848','af:94','af:88'
    ]::text[], l.source_id), 10000),
    l.source_id
  OFFSET greatest(p_offset,0) LIMIT least(greatest(p_limit,1),50);
$$;
REVOKE ALL ON FUNCTION public.list_api_football_league_targets(integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_api_football_league_targets(integer,integer) TO service_role;

-- Team mappings have one current league per source team. Assigning a higher-tier
-- league first makes that team's squad available before low-priority coverage.
CREATE OR REPLACE FUNCTION public.list_api_football_team_targets(
  p_offset integer, p_limit integer, p_squads_only boolean DEFAULT false
)
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
REVOKE ALL ON FUNCTION public.list_api_football_team_targets(integer,integer,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_api_football_team_targets(integer,integer,boolean) TO service_role;

CREATE INDEX IF NOT EXISTS api_football_official_teams_league_idx
  ON public.official_teams (league_source_id, source_id)
  WHERE source_id LIKE 'af:%';

-- Absolute database caps; every attempted request reserves a token first.
-- Lower provider quotas must still be respected by the HTTP client.
CREATE OR REPLACE FUNCTION public.reserve_api_football_quota()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  utc_day timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  utc_minute timestamptz := date_trunc('minute', now());
  consumed integer;
BEGIN
  INSERT INTO public.api_football_quota_usage(window_type,window_start,request_count)
  VALUES ('day',utc_day,1)
  ON CONFLICT (window_type,window_start)
  DO UPDATE SET request_count=public.api_football_quota_usage.request_count+1
  WHERE public.api_football_quota_usage.request_count < 75000
  RETURNING request_count INTO consumed;
  IF consumed IS NULL THEN
    RAISE EXCEPTION 'api_football_daily_quota_exhausted' USING ERRCODE='P0001';
  END IF;

  consumed := NULL;
  INSERT INTO public.api_football_quota_usage(window_type,window_start,request_count)
  VALUES ('minute',utc_minute,1)
  ON CONFLICT (window_type,window_start)
  DO UPDATE SET request_count=public.api_football_quota_usage.request_count+1
  WHERE public.api_football_quota_usage.request_count < 450
  RETURNING request_count INTO consumed;
  IF consumed IS NULL THEN
    RAISE EXCEPTION 'api_football_minute_quota_exhausted' USING ERRCODE='P0001';
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_api_football_quota() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_api_football_quota() TO service_role;

-- Long player-stat league imports resume at the last persisted API page.
-- Each page is upserted before advancing this marker; retries are idempotent.
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
