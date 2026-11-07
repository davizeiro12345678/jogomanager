-- Shared quota for both database-backed import paths. Daily reset is UTC.
-- Other API-Football consumers may use the same provider quota outside this ledger.
-- Limits below use fixed minutes, not a rolling 60-second window.
-- Existing usage is retained. Lower queue settings still limit the queue.
CREATE OR REPLACE FUNCTION public.reserve_api_football_quota()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  utc_day timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  utc_minute timestamptz := date_trunc('minute', now());
  consumed integer;
BEGIN
  INSERT INTO public.api_football_quota_usage(window_type, window_start, request_count)
  VALUES ('day', utc_day, 1)
  ON CONFLICT (window_type, window_start) DO UPDATE
    SET request_count = public.api_football_quota_usage.request_count + 1
    WHERE public.api_football_quota_usage.request_count < 445000
  RETURNING request_count INTO consumed;
  IF consumed IS NULL THEN
    RAISE EXCEPTION 'api_football_daily_quota_exhausted' USING ERRCODE = 'P0001';
  END IF;
  consumed := NULL;
  INSERT INTO public.api_football_quota_usage(window_type, window_start, request_count)
  VALUES ('minute', utc_minute, 1)
  ON CONFLICT (window_type, window_start) DO UPDATE
    SET request_count = public.api_football_quota_usage.request_count + 1
    WHERE public.api_football_quota_usage.request_count < 1100
  RETURNING request_count INTO consumed;
  IF consumed IS NULL THEN
    RAISE EXCEPTION 'api_football_minute_quota_exhausted' USING ERRCODE = 'P0001';
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reserve_api_football_quota() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_api_football_quota() TO service_role;

-- Keep the queue's existing wait and configuration safeguards; its ceiling may
-- be lower than the global ceiling, but it cannot exceed it.
CREATE OR REPLACE FUNCTION public.football_queue_reserve()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s football_import_private.settings%ROWTYPE; admitted integer;
BEGIN
 SELECT * INTO s FROM football_import_private.settings WHERE singleton;
 IF s.next_run_at > now() THEN RAISE EXCEPTION 'football_quota_wait' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.api_football_quota_usage(window_type,window_start,request_count)
 VALUES ('day',date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',1)
 ON CONFLICT(window_type,window_start) DO UPDATE SET request_count=public.api_football_quota_usage.request_count+1
 WHERE public.api_football_quota_usage.request_count < least(445000,s.daily_limit)
 RETURNING request_count INTO admitted;
 IF admitted IS NULL THEN RAISE EXCEPTION 'football_daily_quota_wait' USING ERRCODE='P0001'; END IF;
 admitted:=NULL;
 INSERT INTO public.api_football_quota_usage(window_type,window_start,request_count)
 VALUES ('minute',date_trunc('minute',now()),1)
 ON CONFLICT(window_type,window_start) DO UPDATE SET request_count=public.api_football_quota_usage.request_count+1
 WHERE public.api_football_quota_usage.request_count < least(1100,s.minute_limit)
 RETURNING request_count INTO admitted;
 IF admitted IS NULL THEN RAISE EXCEPTION 'football_minute_quota_wait' USING ERRCODE='P0001'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.football_queue_reserve() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.football_queue_reserve() TO service_role;

-- Do not change the provider key, pause status, cursor, or retry schedule.
UPDATE football_import_private.settings SET daily_limit=445000, minute_limit=1100 WHERE singleton;

CREATE OR REPLACE FUNCTION public.football_queue_configure(p_key text,p_url text,p_daily integer,p_minute integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE key_id uuid; worker_id uuid;
BEGIN
 IF length(p_key) NOT BETWEEN 20 AND 300 OR p_url !~ '^https://[a-z0-9]+\.supabase\.co$'
 OR p_daily<1 OR p_minute<1 THEN RAISE EXCEPTION 'invalid_football_configuration'; END IF;
 SELECT api_key_secret,worker_secret INTO key_id,worker_id FROM football_import_private.settings WHERE singleton FOR UPDATE;
 IF key_id IS NULL THEN key_id:=vault.create_secret(p_key,'football_provider_key');
 ELSE PERFORM vault.update_secret(key_id,p_key); END IF;
 IF worker_id IS NULL THEN worker_id:=vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'football_worker_token'); END IF;
 UPDATE football_import_private.settings SET api_key_secret=key_id,worker_secret=worker_id,project_url=p_url,
 daily_limit=least(p_daily,445000),minute_limit=least(p_minute,1100) WHERE singleton;
 RETURN jsonb_build_object('configured',true,'dailyLimit',least(p_daily,445000),'minuteLimit',least(p_minute,1100));
END $$;

REVOKE ALL ON FUNCTION public.football_queue_configure(text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.football_queue_configure(text,text,integer,integer) TO service_role;
