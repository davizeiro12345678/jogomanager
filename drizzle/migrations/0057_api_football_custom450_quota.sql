-- Keep UTC day totals and fixed-minute telemetry. A bounded 61-slot ring
-- enforces the rolling minute across both import paths and live squad lookups.
CREATE TABLE IF NOT EXISTS football_import_private.quota_seconds (
  slot integer PRIMARY KEY CHECK (slot BETWEEN 0 AND 60),
  epoch_second bigint NOT NULL,
  request_count integer NOT NULL CHECK (request_count BETWEEN 1 AND 19)
);
REVOKE ALL ON football_import_private.quota_seconds FROM PUBLIC, anon, authenticated;

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
  PERFORM pg_advisory_xact_lock(724019102);
  ts := clock_timestamp();
  utc_day := date_trunc('day', ts AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  epoch_second_now := floor(extract(epoch FROM ts))::bigint;

  SELECT coalesce(sum(request_count) FILTER (WHERE epoch_second = epoch_second_now), 0),
         coalesce(sum(request_count), 0)
    INTO second_count, minute_count
    FROM football_import_private.quota_seconds
    WHERE epoch_second >= epoch_second_now - 60;
  IF second_count >= 19 OR minute_count >= least(1100, p_minute) THEN
    RETURN 'minute';
  END IF;

  INSERT INTO public.api_football_quota_usage(window_type, window_start, request_count)
  VALUES ('day', utc_day, 1)
  ON CONFLICT (window_type, window_start) DO UPDATE
    SET request_count = public.api_football_quota_usage.request_count + 1
    WHERE public.api_football_quota_usage.request_count < least(445000, p_daily)
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
REVOKE ALL ON FUNCTION football_import_private.reserve_provider_call(integer, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_api_football_quota()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result text;
BEGIN
  result := football_import_private.reserve_provider_call(445000, 1100);
  IF result = 'day' THEN
    RAISE EXCEPTION 'api_football_daily_quota_exhausted' USING ERRCODE = 'P0001';
  ELSIF result = 'minute' THEN
    RAISE EXCEPTION 'api_football_minute_quota_exhausted' USING ERRCODE = 'P0001';
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reserve_api_football_quota() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_api_football_quota() TO service_role;

CREATE OR REPLACE FUNCTION public.football_queue_reserve()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s football_import_private.settings%ROWTYPE; result text;
BEGIN
  SELECT * INTO STRICT s FROM football_import_private.settings WHERE singleton;
  IF s.next_run_at > now() THEN RAISE EXCEPTION 'football_quota_wait' USING ERRCODE = 'P0001'; END IF;
  result := football_import_private.reserve_provider_call(s.daily_limit, s.minute_limit);
  IF result = 'day' THEN
    RAISE EXCEPTION 'football_daily_quota_wait' USING ERRCODE = 'P0001';
  ELSIF result = 'minute' THEN
    RAISE EXCEPTION 'football_minute_quota_wait' USING ERRCODE = 'P0001';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.football_queue_reserve() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.football_queue_reserve() TO service_role;

-- Preserve the current pause, cursor, usage, and retry schedule.
UPDATE football_import_private.settings SET daily_limit = 445000, minute_limit = 1100 WHERE singleton;

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

-- Keep the global lease ceiling bounded independently of the Edge invocation
-- count. Workers start with three lanes and can be ramped without another DDL.
CREATE OR REPLACE FUNCTION public.football_queue_claim()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j football_import_private.jobs%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(724019101);
  UPDATE football_import_private.jobs
    SET status = 'pending', lease_token = NULL, lease_until = NULL
    WHERE status = 'running' AND lease_until < now();
  IF (SELECT count(*) FROM football_import_private.jobs WHERE status = 'running') >= 16 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO j FROM football_import_private.jobs
    WHERE status IN ('pending', 'failed') AND retry_at <= now() AND attempts < 8
    ORDER BY priority, path FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE football_import_private.jobs
    SET status = 'running', attempts = attempts + 1,
        lease_token = gen_random_uuid(), lease_until = now() + interval '120 seconds'
    WHERE path = j.path RETURNING * INTO j;
  RETURN to_jsonb(j);
END $$;
REVOKE ALL ON FUNCTION public.football_queue_claim() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.football_queue_claim() TO service_role;
