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
