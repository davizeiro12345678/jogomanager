-- Keep the account's day and rolling-minute limits shared by every
-- API-Football caller. These are reservation ceilings, not a request target.
ALTER TABLE football_import_private.quota_seconds
  DROP CONSTRAINT IF EXISTS quota_seconds_request_count_check,
  ADD CONSTRAINT quota_seconds_request_count_check CHECK (request_count BETWEEN 1 AND 20);

CREATE OR REPLACE FUNCTION football_import_private.reserve_provider_call(
  p_daily integer, p_minute integer
)
RETURNS text LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  ts timestamptz;
  utc_day timestamptz;
  epoch_second_now bigint;
  second_count integer;
  minute_count integer;
  consumed integer;
BEGIN
  IF p_daily IS NULL OR p_minute IS NULL OR p_daily < 1 OR p_minute < 1 THEN
    RAISE EXCEPTION 'invalid_football_quota_settings' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(724019102);
  ts := clock_timestamp();
  utc_day := date_trunc('day', ts AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  epoch_second_now := floor(extract(epoch FROM ts))::bigint;

  SELECT coalesce(sum(request_count) FILTER (WHERE epoch_second = epoch_second_now), 0),
         coalesce(sum(request_count), 0)
    INTO second_count, minute_count
    FROM football_import_private.quota_seconds
    WHERE epoch_second >= epoch_second_now - 60;
  IF second_count >= 20 OR minute_count >= least(1200, p_minute) THEN
    RETURN 'minute';
  END IF;

  INSERT INTO public.api_football_quota_usage(window_type, window_start, request_count)
  VALUES ('day', utc_day, 1)
  ON CONFLICT (window_type, window_start) DO UPDATE
    SET request_count = public.api_football_quota_usage.request_count + 1
    WHERE public.api_football_quota_usage.request_count < least(450000, p_daily)
  RETURNING request_count INTO consumed;
  IF consumed IS NULL THEN RETURN 'day'; END IF;

  INSERT INTO public.api_football_quota_usage(window_type, window_start, request_count)
  VALUES ('minute', date_trunc('minute', ts), 1)
  ON CONFLICT (window_type, window_start) DO UPDATE
    SET request_count = public.api_football_quota_usage.request_count + 1;

  INSERT INTO football_import_private.quota_seconds AS q(slot, epoch_second, request_count)
  VALUES ((epoch_second_now % 61)::integer, epoch_second_now, 1)
  ON CONFLICT (slot) DO UPDATE SET
    epoch_second = EXCLUDED.epoch_second,
    request_count = CASE WHEN q.epoch_second = EXCLUDED.epoch_second
                         THEN q.request_count + 1 ELSE 1 END;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION football_import_private.reserve_provider_call(integer, integer)
  FROM PUBLIC, anon, authenticated;

-- All direct callers honor the same configured lower plan, if present.
CREATE OR REPLACE FUNCTION public.reserve_api_football_quota()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result text;
  limits football_import_private.settings%ROWTYPE;
BEGIN
  SELECT * INTO STRICT limits FROM football_import_private.settings WHERE singleton;
  result := football_import_private.reserve_provider_call(limits.daily_limit, limits.minute_limit);
  IF result = 'day' THEN
    RAISE EXCEPTION 'api_football_daily_quota_exhausted' USING ERRCODE = 'P0001';
  ELSIF result = 'minute' THEN
    RAISE EXCEPTION 'api_football_minute_quota_exhausted' USING ERRCODE = 'P0001';
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reserve_api_football_quota() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_api_football_quota() TO service_role;

CREATE OR REPLACE FUNCTION public.football_queue_configure(p_key text,p_url text,p_daily integer,p_minute integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE key_id uuid; worker_id uuid;
BEGIN
 IF p_key IS NULL OR p_url IS NULL OR p_daily IS NULL OR p_minute IS NULL
 OR length(p_key) NOT BETWEEN 20 AND 300 OR p_url !~ '^https://[a-z0-9]+\.supabase\.co$'
 OR p_daily<1 OR p_minute<1 THEN RAISE EXCEPTION 'invalid_football_configuration'; END IF;
 SELECT api_key_secret,worker_secret INTO key_id,worker_id FROM football_import_private.settings WHERE singleton FOR UPDATE;
 IF key_id IS NULL THEN key_id:=vault.create_secret(p_key,'football_provider_key');
 ELSE PERFORM vault.update_secret(key_id,p_key); END IF;
 IF worker_id IS NULL THEN worker_id:=vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'football_worker_token'); END IF;
 UPDATE football_import_private.settings SET api_key_secret=key_id,worker_secret=worker_id,project_url=p_url,
 daily_limit=least(p_daily,450000),minute_limit=least(p_minute,1200) WHERE singleton;
 RETURN jsonb_build_object('configured',true,'dailyLimit',least(p_daily,450000),'minuteLimit',least(p_minute,1200));
END $$;
REVOKE ALL ON FUNCTION public.football_queue_configure(text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.football_queue_configure(text,text,integer,integer) TO service_role;

-- Summaries from concurrent workers are accumulated atomically per UTC minute.
CREATE OR REPLACE FUNCTION public.football_queue_window(p_summary jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE football_import_private.settings
  SET last_window_at = now(),
      last_window = CASE
        WHEN date_trunc('minute', last_window_at) = date_trunc('minute', now()) THEN
          jsonb_build_object(
            'windows', coalesce((last_window->>'windows')::integer, 1) + 1,
            'completed', coalesce((last_window->>'completed')::integer, 0) + coalesce((p_summary->>'completed')::integer, 0),
            'failed', coalesce((last_window->>'failed')::integer, 0) + coalesce((p_summary->>'failed')::integer, 0),
            'deferred', coalesce((last_window->>'deferred')::integer, 0) + coalesce((p_summary->>'deferred')::integer, 0),
            'requests', coalesce((last_window->>'requests')::integer, 0) + coalesce((p_summary->>'requests')::integer, 0),
            'remaining', least((last_window->>'remaining')::integer, (p_summary->>'remaining')::integer)
          )
        ELSE p_summary || jsonb_build_object('windows', 1)
      END
  WHERE singleton;
$$;
REVOKE ALL ON FUNCTION public.football_queue_window(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.football_queue_window(jsonb) TO service_role;

-- A provider 429 pauses every worker; releasing a job for a local scheduling
-- limit alone does not pause the whole queue.
CREATE OR REPLACE FUNCTION public.football_queue_defer(
  p_path text, p_lease uuid, p_code text, p_wait integer, p_budget boolean DEFAULT false
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 UPDATE football_import_private.jobs SET status=CASE WHEN p_budget THEN 'pending' ELSE 'failed' END,
 attempts=greatest(0,attempts-CASE WHEN p_budget THEN 1 ELSE 0 END),error=CASE WHEN p_budget THEN NULL ELSE left(p_code,120) END,
 retry_at=CASE WHEN p_code IN ('football_daily_quota_wait','provider_daily_quota') THEN (date_trunc('day',now() AT TIME ZONE 'UTC')+interval '1 day') AT TIME ZONE 'UTC' ELSE now()+make_interval(secs=>greatest(1,least(p_wait,86400))) END,lease_token=NULL,lease_until=NULL
 WHERE path=p_path AND lease_token=p_lease AND status='running';
 IF p_code IN ('football_daily_quota_wait','provider_daily_quota') THEN
   UPDATE football_import_private.settings SET next_run_at=greatest(next_run_at,(date_trunc('day',now() AT TIME ZONE 'UTC')+interval '1 day') AT TIME ZONE 'UTC') WHERE singleton;
 ELSIF p_code = 'provider_rate_wait' THEN
   UPDATE football_import_private.settings SET next_run_at=greatest(next_run_at,now()+make_interval(secs=>greatest(1,least(p_wait,60)))) WHERE singleton;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.football_queue_defer(text,uuid,text,integer,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.football_queue_defer(text,uuid,text,integer,boolean) TO service_role;

-- Divide the existing global 16 leases between four short Edge invocations.
-- The shared reservation function still enforces the provider's total quota.
CREATE OR REPLACE FUNCTION football_import_private.invoke_worker()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s football_import_private.settings%ROWTYPE; token text; request_id bigint;
BEGIN
 SELECT * INTO s FROM football_import_private.settings WHERE singleton;
 IF NOT FOUND OR NOT s.enabled OR s.next_run_at>now() THEN RETURN NULL; END IF;
 SELECT decrypted_secret INTO token FROM vault.decrypted_secrets WHERE id=s.worker_secret;
 IF token IS NULL OR s.project_url IS NULL THEN RETURN NULL; END IF;
 SELECT net.http_post(
   url:=s.project_url||'/functions/v1/api-football-import',
   headers:=jsonb_build_object('content-type','application/json','x-football-worker',token),
   body:='{"action":"run","workerLanes":4}'::jsonb,
   timeout_milliseconds:=55000
 ) INTO request_id;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION football_import_private.invoke_worker() FROM PUBLIC, anon, authenticated;

-- Reuse the existing job and its enabled state rather than adding a second job.
DO $$
DECLARE target_job bigint;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    SELECT jobid INTO target_job FROM cron.job WHERE jobname = 'api-football-history';
    IF target_job IS NOT NULL THEN
      PERFORM cron.alter_job(
        job_id := target_job,
        schedule := '15 seconds',
        command := 'SELECT football_import_private.invoke_worker() FROM pg_catalog.generate_series(1,4);'
      );
    END IF;
  END IF;
END $$;

-- Only lift the previous Custom450 ceilings; preserve a lower-plan setting,
-- all counters, the existing pause, and in-flight work.
UPDATE football_import_private.settings
SET daily_limit = CASE WHEN daily_limit = 445000 THEN 450000 ELSE daily_limit END,
    minute_limit = CASE WHEN minute_limit = 1100 THEN 1200 ELSE minute_limit END
WHERE singleton;
