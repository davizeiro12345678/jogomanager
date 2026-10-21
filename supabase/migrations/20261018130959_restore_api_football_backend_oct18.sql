-- Source: supabase/migrations/20261014195500_api_football_safe_reimport.sql
-- Safe to apply while the provider credential is absent; nothing is scheduled or started.
-- Quotas are absolute caps. A reserved token counts even when an upstream call fails.
CREATE TABLE IF NOT EXISTS public.api_football_import_progress (
  phase text PRIMARY KEY CHECK (phase IN (
    'leagues','teams','squads','fixtures','standings','predictions','odds','stats',
    'countries','timezones','venues','coaches','injuries','teamstats','details'
  )),
  next_offset integer NOT NULL DEFAULT 0 CHECK (next_offset >= 0),
  batch_size integer NOT NULL DEFAULT 30 CHECK (batch_size BETWEEN 1 AND 50),
  status text NOT NULL DEFAULT 'paused' CHECK (status IN ('paused','queued','running','completed','failed')),
  lease_until timestamptz,
  lease_token uuid,
  error_message text,
  total_processed bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.api_football_import_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_football_import_progress FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.api_football_import_progress TO service_role;

CREATE TABLE IF NOT EXISTS public.api_football_quota_usage (
  window_type text NOT NULL CHECK (window_type IN ('minute','day')),
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (window_type,window_start)
);
ALTER TABLE public.api_football_quota_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_football_quota_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.api_football_quota_usage TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_api_football_quota()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  utc_day timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  utc_minute timestamptz := date_trunc('minute', now());
  consumed integer;
BEGIN
  INSERT INTO public.api_football_quota_usage(window_type,window_start,request_count)
  VALUES ('day',utc_day,1)
  ON CONFLICT (window_type,window_start)
  DO UPDATE SET request_count=public.api_football_quota_usage.request_count+1
  WHERE public.api_football_quota_usage.request_count < 75009
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
    -- Exception rolls back both reservations, including the daily count.
    RAISE EXCEPTION 'api_football_minute_quota_exhausted' USING ERRCODE='P0001';
  END IF;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.reserve_api_football_quota() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_api_football_quota() TO service_role;

INSERT INTO public.api_football_import_progress(phase,status)
SELECT phase, 'paused'
FROM unnest(ARRAY[
  'leagues','teams','squads','fixtures','standings','predictions','odds','stats',
  'countries','timezones','venues','coaches','injuries','teamstats','details'
]) AS phase
ON CONFLICT (phase) DO NOTHING;


-- Source: supabase/migrations/20261014195600_api_football_job_lease.sql
-- Atomic lease acquisition for one safe API-Football batch. Only service_role can run this RPC.
CREATE OR REPLACE FUNCTION public.claim_api_football_import_phase()
RETURNS TABLE(out_phase text, out_offset integer, out_limit integer, out_token uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH next_job AS (
    SELECT candidate.phase
    FROM public.api_football_import_progress AS candidate
    WHERE candidate.status = 'queued'
       OR (candidate.status = 'running' AND candidate.lease_until < now())
    ORDER BY candidate.updated_at, candidate.phase
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.api_football_import_progress AS job
  SET status='running',lease_token=gen_random_uuid(),
      lease_until=now()+interval '100 seconds',updated_at=now(),error_message=NULL
  FROM next_job
  WHERE job.phase=next_job.phase
  RETURNING job.phase,job.next_offset,job.batch_size,job.lease_token;
$function$;
REVOKE ALL ON FUNCTION public.claim_api_football_import_phase() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_api_football_import_phase() TO service_role;


-- Source: supabase/migrations/20261014195700_api_football_job_finalize.sql
-- Complete one leased batch only when the original lease token still owns the phase.
CREATE OR REPLACE FUNCTION public.complete_api_football_import_phase(
  p_phase text, p_token uuid, p_processed integer, p_next_offset integer,
  p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.api_football_import_progress AS job
  SET
    status=CASE
      WHEN p_error IS NOT NULL AND p_error LIKE '%quota%' THEN 'paused'
      WHEN p_error IS NOT NULL THEN 'failed'
      WHEN p_next_offset IS NULL THEN 'completed'
      ELSE 'queued'
    END,
    next_offset=CASE
      WHEN p_error IS NULL AND p_next_offset IS NOT NULL
        THEN p_next_offset
      ELSE job.next_offset
    END,
    total_processed=job.total_processed+CASE
      WHEN p_error IS NULL THEN GREATEST(0,p_processed) ELSE 0
    END,
    error_message=LEFT(p_error,1000),
    lease_token=NULL,
    lease_until=NULL,
    updated_at=now()
  WHERE job.phase=p_phase
    AND job.status='running'
    AND job.lease_token=p_token;
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows=1;
END;
$function$;
REVOKE ALL ON FUNCTION public.complete_api_football_import_phase(text,uuid,integer,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_api_football_import_phase(text,uuid,integer,integer,text) TO service_role;


-- Source: supabase/migrations/20261016150000_api_football_priority_targets.sql
-- API-Football: prioritize real league-season targets server-side.
-- These functions do not trigger imports; only service_role can request pages.
-- Some installations already have this raw archive from Drizzle; a freshly
-- provisioned Supabase environment may not. Keep it service-only either way.
CREATE TABLE IF NOT EXISTS public.api_football_data (
  kind text NOT NULL,
  ref text NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, ref)
);
ALTER TABLE public.api_football_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read football data" ON public.api_football_data;
REVOKE ALL ON TABLE public.api_football_data FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.api_football_data TO service_role;

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

CREATE OR REPLACE FUNCTION public.list_api_football_league_targets(
  p_offset integer, p_limit integer
)
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

-- A rate-limit is not a permanent failure. Release the job for the next
-- quota window instead of leaving the importer paused indefinitely.
ALTER TABLE public.api_football_import_progress
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0
  CHECK (consecutive_failures >= 0);

CREATE OR REPLACE FUNCTION public.claim_api_football_import_phase()
RETURNS TABLE(out_phase text, out_offset integer, out_limit integer, out_token uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  WITH next_job AS (
    SELECT candidate.phase
    FROM public.api_football_import_progress AS candidate
    WHERE (candidate.status = 'queued' AND
      (candidate.lease_until IS NULL OR candidate.lease_until <= now()))
       OR (candidate.status = 'running' AND candidate.lease_until < now())
    ORDER BY candidate.updated_at, candidate.phase
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.api_football_import_progress AS job
  SET status='running', lease_token=gen_random_uuid(),
      lease_until=now()+interval '100 seconds',updated_at=now(),error_message=NULL
  FROM next_job
  WHERE job.phase=next_job.phase
  RETURNING job.phase,job.next_offset,job.batch_size,job.lease_token;
$$;
REVOKE ALL ON FUNCTION public.claim_api_football_import_phase() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_api_football_import_phase() TO service_role;

CREATE OR REPLACE FUNCTION public.complete_api_football_import_phase(
  p_phase text, p_token uuid, p_processed integer, p_next_offset integer,
  p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.api_football_import_progress AS job
  SET
    status=CASE
      WHEN p_error IS NULL AND p_next_offset IS NULL THEN 'completed'
      WHEN p_error IS NULL THEN 'queued'
      WHEN p_error LIKE '%quota_exhausted%' THEN 'queued'
      WHEN job.consecutive_failures >= 4 THEN 'failed'
      ELSE 'queued'
    END,
    next_offset=CASE
      WHEN p_error IS NULL AND p_next_offset IS NOT NULL THEN p_next_offset
      ELSE job.next_offset END,
    total_processed=job.total_processed+CASE
      WHEN p_error IS NULL THEN greatest(0,p_processed) ELSE 0 END,
    consecutive_failures=CASE
      WHEN p_error IS NULL OR p_error LIKE '%quota_exhausted%'
        THEN 0 ELSE job.consecutive_failures+1 END,
    error_message=left(p_error,1000),
    lease_token=NULL,
    lease_until=CASE
      WHEN p_error LIKE '%daily_quota_exhausted%'
        THEN (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')+interval '1 day'
      WHEN p_error LIKE '%minute_quota_exhausted%'
        THEN date_trunc('minute',now())+interval '1 minute'
      WHEN p_error IS NOT NULL
        THEN now()+make_interval(secs => least(300, 10*power(2,least(job.consecutive_failures,5))::integer))
      ELSE NULL END,
    updated_at=now()
  WHERE job.phase=p_phase AND job.status='running' AND job.lease_token=p_token;
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows=1;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_api_football_import_phase(text,uuid,integer,integer,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_api_football_import_phase(text,uuid,integer,integer,text)
  TO service_role;
