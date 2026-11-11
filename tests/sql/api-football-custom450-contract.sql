-- Run only in a disposable database after applying the quota migrations.
BEGIN;

-- Isolated fixture: exercise Custom450 at its full authorized limits
-- without assuming an existing installation has upgraded its lower plan.
-- ROLLBACK below preserves all real settings and imported counters.
UPDATE football_import_private.settings
SET daily_limit = 450000, minute_limit = 1200
WHERE singleton;

DO $
DECLARE
  day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  epoch_now bigint;
  outcome text;
  denied boolean := false;
  configured jsonb;
  invalid_limit integer;
  snapshot jsonb;
  test_lease uuid := '00000000-0000-0000-0000-000000000123';
  test_worker uuid;
  queued_before bigint;
  queued_after bigint;
BEGIN
  IF (SELECT daily_limit FROM football_import_private.settings WHERE singleton) <> 450000
     OR (SELECT minute_limit FROM football_import_private.settings WHERE singleton) <> 1200 THEN
    RAISE EXCEPTION 'Custom450 settings were not upgraded';
  END IF;

  DELETE FROM football_import_private.quota_seconds;
  DELETE FROM public.api_football_quota_usage;
  INSERT INTO public.api_football_quota_usage(window_type, window_start, request_count)
  VALUES ('day', day_start, 449999);
  outcome := football_import_private.reserve_provider_call(450000, 1200);
  IF outcome <> 'ok' THEN RAISE EXCEPTION '450000th daily call was rejected: %', outcome; END IF;
  outcome := football_import_private.reserve_provider_call(450000, 1200);
  IF outcome <> 'day' THEN RAISE EXCEPTION 'daily ceiling was exceeded: %', outcome; END IF;

  DELETE FROM football_import_private.quota_seconds;
  DELETE FROM public.api_football_quota_usage;
  epoch_now := floor(extract(epoch FROM clock_timestamp()))::bigint;
  INSERT INTO football_import_private.quota_seconds(slot, epoch_second, request_count)
  SELECT ((epoch_now - n) % 61)::integer, epoch_now - n,
         CASE WHEN n = 0 THEN 19 ELSE 20 END
  FROM generate_series(0, 59) AS n;
  outcome := football_import_private.reserve_provider_call(450000, 1200);
  IF outcome <> 'ok' THEN RAISE EXCEPTION '1200th rolling-minute call was rejected: %', outcome; END IF;
  outcome := football_import_private.reserve_provider_call(450000, 1200);
  IF outcome <> 'minute' THEN RAISE EXCEPTION 'rolling-minute ceiling was exceeded: %', outcome; END IF;

  DELETE FROM football_import_private.quota_seconds;
  DELETE FROM public.api_football_quota_usage;
  INSERT INTO public.api_football_quota_usage(window_type, window_start, request_count)
  VALUES ('day', day_start, 10);
  outcome := football_import_private.reserve_provider_call(10, 1200);
  IF outcome <> 'day' THEN RAISE EXCEPTION 'lower plan daily limit was ignored: %', outcome; END IF;

  UPDATE football_import_private.settings SET daily_limit = 10 WHERE singleton;
  BEGIN
    PERFORM public.reserve_api_football_quota();
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'direct caller ignored the configured daily limit'; END IF;

  DELETE FROM football_import_private.quota_seconds;
  DELETE FROM public.api_football_quota_usage;
  epoch_now := floor(extract(epoch FROM clock_timestamp()))::bigint;
  INSERT INTO football_import_private.quota_seconds(slot, epoch_second, request_count)
  VALUES ((epoch_now % 61)::integer, epoch_now, 10);
  outcome := football_import_private.reserve_provider_call(450000, 10);
  IF outcome <> 'minute' THEN RAISE EXCEPTION 'lower plan minute limit was ignored: %', outcome; END IF;

  configured := public.football_queue_configure(repeat('x', 24), 'https://abc123.supabase.co', 450000, 1200);
  IF (configured->>'dailyLimit')::integer <> 450000 OR (configured->>'minuteLimit')::integer <> 1200 THEN
    RAISE EXCEPTION 'configuration clipped the Custom450 plan';
  END IF;
  configured := public.football_queue_configure(repeat('x', 24), 'https://abc123.supabase.co', 100, 10);
  IF (configured->>'dailyLimit')::integer <> 100 OR (configured->>'minuteLimit')::integer <> 10 THEN
    RAISE EXCEPTION 'configuration ignored a lower provider plan';
  END IF;
  denied := false;
  BEGIN
    PERFORM public.football_queue_configure(repeat('x', 24), 'https://abc123.supabase.co', NULL, 1200);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'missing provider daily limit was accepted'; END IF;
  denied := false;
  BEGIN
    PERFORM public.football_queue_configure(repeat('x', 24), 'https://abc123.supabase.co', 450000, NULL);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'missing provider minute limit was accepted'; END IF;

  DELETE FROM football_import_private.quota_seconds;
  DELETE FROM public.api_football_quota_usage;
  FOREACH invalid_limit IN ARRAY ARRAY[NULL, 0, -1]::integer[] LOOP
    denied := false;
    BEGIN
      PERFORM football_import_private.reserve_provider_call(invalid_limit, 1200);
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      denied := true;
    END;
    IF NOT denied THEN RAISE EXCEPTION 'invalid daily reservation limit was accepted: %', invalid_limit; END IF;
  END LOOP;

  IF has_function_privilege('anon', 'public.reserve_api_football_quota()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.reserve_api_football_quota()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.reserve_api_football_quota()', 'EXECUTE') THEN
    RAISE EXCEPTION 'quota RPC access changed';
  END IF;

  UPDATE football_import_private.settings SET last_window_at = NULL, last_window = NULL WHERE singleton;
  PERFORM public.football_queue_window('{"completed":2,"failed":1,"deferred":0,"requests":3,"remaining":100}'::jsonb);
  PERFORM public.football_queue_window('{"completed":5,"failed":0,"deferred":1,"requests":5,"remaining":97}'::jsonb);
  SELECT last_window INTO snapshot FROM football_import_private.settings WHERE singleton;
  IF (snapshot->>'completed')::integer <> 7 OR (snapshot->>'failed')::integer <> 1
     OR (snapshot->>'requests')::integer <> 8 OR (snapshot->>'deferred')::integer <> 1
     OR (snapshot->>'remaining')::integer <> 97 OR (snapshot->>'windows')::integer <> 2 THEN
    RAISE EXCEPTION 'parallel worker summaries were not aggregated: %', snapshot;
  END IF;

  UPDATE football_import_private.settings SET next_run_at = now() - interval '1 second' WHERE singleton;
  INSERT INTO football_import_private.jobs(path, kind, meta, priority, status, attempts, lease_token, lease_until)
  VALUES ('/contract-test?job=1', 'test', '{}'::jsonb, 0, 'running', 1, test_lease, now() + interval '1 minute');
  PERFORM public.football_queue_defer('/contract-test?job=1', test_lease, 'provider_rate_wait', 60, true);
  IF (SELECT next_run_at FROM football_import_private.settings WHERE singleton) < now() + interval '59 seconds' THEN
    RAISE EXCEPTION 'provider rate limit did not pause other workers';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM football_import_private.jobs WHERE path = '/contract-test?job=1'
                 AND status = 'pending' AND attempts = 0 AND lease_token IS NULL) THEN
    RAISE EXCEPTION 'rate-limited job was not released safely';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'api-football-history' AND schedule = '15 seconds') THEN
    RAISE EXCEPTION 'parallel worker schedule was not installed';
  END IF;
  test_worker := vault.create_secret(repeat('a', 64), 'football_contract_' || gen_random_uuid()::text);
  UPDATE football_import_private.settings SET enabled = true, next_run_at = now() - interval '1 second',
    worker_secret = test_worker, project_url = 'https://abc123.supabase.co' WHERE singleton;
  SELECT coalesce(max(id),0) INTO queued_before FROM net.http_request_queue;
  EXECUTE (SELECT command FROM cron.job WHERE jobname = 'api-football-history');
  SELECT count(*) INTO queued_after FROM net.http_request_queue
    WHERE id > queued_before AND convert_from(body, 'UTF8')::jsonb = '{"action":"run","workerLanes":4}'::jsonb;
  IF queued_after <> 4 THEN RAISE EXCEPTION 'four bounded workers were not enqueued: %', queued_after; END IF;
END $$;

ROLLBACK;
