-- Private durable provider queue. No gameplay/save tables are reset.
CREATE SCHEMA IF NOT EXISTS football_import_private;
REVOKE ALL ON SCHEMA football_import_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS football_import_private.settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  admin_hash text,
  api_key_secret uuid,
  worker_secret uuid,
  project_url text,
  daily_limit integer NOT NULL DEFAULT 75000,
  minute_limit integer NOT NULL DEFAULT 450,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  cutoff timestamptz NOT NULL DEFAULT now(),
  last_window_at timestamptz,
  last_window jsonb
);
INSERT INTO football_import_private.settings(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS football_import_private.jobs (
  path text PRIMARY KEY CHECK (length(path) BETWEEN 1 AND 2048),
  kind text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}',
  priority integer NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','done','failed','unavailable')),
  attempts integer NOT NULL DEFAULT 0,
  retry_at timestamptz NOT NULL DEFAULT now(),
  error text,
  cache_hash text,
  cached_body jsonb,
  completed_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  received integer,
  imported_checkpoint boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS football_queue_due ON football_import_private.jobs(priority,path)
  WHERE status IN ('pending','failed');
CREATE INDEX IF NOT EXISTS football_queue_lease ON football_import_private.jobs(lease_until) WHERE status='running';
CREATE TABLE IF NOT EXISTS football_import_private.receipts (
  path text PRIMARY KEY REFERENCES football_import_private.jobs(path),
  received integer NOT NULL,
  inserted integer NOT NULL,
  updated integer NOT NULL,
  unchanged integer NOT NULL,
  skipped integer NOT NULL,
  provider_requests integer NOT NULL,
  remaining_quota integer,
  completed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE football_import_private.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE football_import_private.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE football_import_private.settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA football_import_private FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.football_queue_settings(p_hash text,p_admin boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s football_import_private.settings%ROWTYPE; worker text; api text;
BEGIN
 SELECT * INTO s FROM football_import_private.settings WHERE singleton;
 IF p_admin THEN
   IF s.admin_hash IS NULL OR p_hash IS DISTINCT FROM s.admin_hash THEN RETURN NULL; END IF;
 ELSE
   SELECT decrypted_secret INTO worker FROM vault.decrypted_secrets WHERE id=s.worker_secret;
   IF worker IS NULL OR p_hash IS DISTINCT FROM encode(extensions.digest(worker,'sha256'),'hex') THEN RETURN NULL; END IF;
 END IF;
 SELECT decrypted_secret INTO api FROM vault.decrypted_secrets WHERE id=s.api_key_secret;
 RETURN jsonb_build_object('enabled',s.enabled,'apiKey',api,'cutoff',s.cutoff,'nextRunAt',s.next_run_at);
END $$;

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
 daily_limit=least(p_daily,75000),minute_limit=least(p_minute,450) WHERE singleton;
 RETURN jsonb_build_object('configured',true,'dailyLimit',least(p_daily,75000),'minuteLimit',least(p_minute,450));
END $$;

CREATE OR REPLACE FUNCTION public.football_queue_seed(p_jobs jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF jsonb_typeof(p_jobs)<>'array' OR jsonb_array_length(p_jobs)>500 OR pg_column_size(p_jobs)>2000000 THEN RAISE EXCEPTION 'queue_seed_too_large'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_jobs) x WHERE x->>'status' NOT IN ('done','pending','failed') OR length(x->>'path')>2048
 OR (left(x->>'path',1)<>'/' AND x->>'status'<>'done') OR left(x->>'path',2)='//') THEN RAISE EXCEPTION 'invalid_queue_seed'; END IF;
 INSERT INTO football_import_private.jobs(path,kind,meta,priority,status,attempts,retry_at,error,cache_hash,completed_at,imported_checkpoint)
 SELECT x.path,x.kind,coalesce(x.meta,'{}'),x.priority,x.status,greatest(0,x.attempts),
 coalesce(to_timestamp(x.retry_at/1000.0),now()),x.error,x.cache_hash,x.completed_at,true
 FROM jsonb_to_recordset(p_jobs) AS x(path text,kind text,meta jsonb,priority integer,status text,attempts integer,retry_at bigint,error text,cache_hash text,completed_at timestamptz)
 ON CONFLICT(path) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN jsonb_build_object('seeded',n);
END $$;

CREATE OR REPLACE FUNCTION public.football_queue_claim()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j football_import_private.jobs%ROWTYPE;
BEGIN
 -- Serialize admission, not network work; at most three live leases globally.
 PERFORM pg_advisory_xact_lock(724019101);
 UPDATE football_import_private.jobs SET status='pending',lease_token=NULL,lease_until=NULL
 WHERE status='running' AND lease_until<now();
 IF (SELECT count(*) FROM football_import_private.jobs WHERE status='running')>=3 THEN RETURN NULL; END IF;
 SELECT * INTO j FROM football_import_private.jobs WHERE status IN ('pending','failed') AND retry_at<=now() AND attempts<8
 ORDER BY priority,path FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE football_import_private.jobs SET status='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '120 seconds'
 WHERE path=j.path RETURNING * INTO j;
 RETURN to_jsonb(j);
END $$;

CREATE OR REPLACE FUNCTION public.football_queue_cache(p_path text,p_text text,p_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF octet_length(p_text)>12000000 OR encode(extensions.digest(p_text,'sha256'),'hex') IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'queue_cache_invalid'; END IF;
 UPDATE football_import_private.jobs SET cached_body=p_text::jsonb WHERE path=p_path AND status IN ('pending','failed') AND cache_hash=p_hash;
 RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.football_queue_reserve()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s football_import_private.settings%ROWTYPE; admitted integer;
BEGIN
 SELECT * INTO s FROM football_import_private.settings WHERE singleton;
 IF s.next_run_at>now() THEN RAISE EXCEPTION 'football_quota_wait' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.api_football_quota_usage(window_type,window_start,request_count)
 VALUES('day',date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',1)
 ON CONFLICT(window_type,window_start) DO UPDATE SET request_count=public.api_football_quota_usage.request_count+1
 WHERE public.api_football_quota_usage.request_count<greatest(1,s.daily_limit-least(500,s.daily_limit/20)) RETURNING request_count INTO admitted;
 IF admitted IS NULL THEN RAISE EXCEPTION 'football_daily_quota_wait' USING ERRCODE='P0001'; END IF;
 admitted:=NULL;
 INSERT INTO public.api_football_quota_usage(window_type,window_start,request_count) VALUES('minute',date_trunc('minute',now()),1)
 ON CONFLICT(window_type,window_start) DO UPDATE SET request_count=public.api_football_quota_usage.request_count+1
 WHERE public.api_football_quota_usage.request_count<greatest(1,s.minute_limit*9/10) RETURNING request_count INTO admitted;
 IF admitted IS NULL THEN RAISE EXCEPTION 'football_minute_quota_wait' USING ERRCODE='P0001'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.football_queue_finish(p_path text,p_lease uuid,p_writes jsonb,p_children jsonb,p_received integer,p_requests integer,p_remaining integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j football_import_private.jobs%ROWTYPE; batch jsonb; rowdata jsonb; previous jsonb;
 target text; keys text[]; cols text; vals text; updates text; predicate text; col text; changes integer;
 n_insert integer:=0; n_update integer:=0; n_same integer:=0; n_skip integer:=0; result jsonb;
BEGIN
 SELECT * INTO j FROM football_import_private.jobs WHERE path=p_path FOR UPDATE;
 IF j.status='done' THEN SELECT to_jsonb(r) INTO result FROM football_import_private.receipts r WHERE path=p_path; RETURN result; END IF;
 IF j.status<>'running' OR j.lease_token IS DISTINCT FROM p_lease OR j.lease_until<now() THEN RAISE EXCEPTION 'queue_lease_lost'; END IF;
 IF pg_column_size(p_writes)>24000000 OR jsonb_array_length(p_children)>100000 OR p_received<0 THEN RAISE EXCEPTION 'queue_result_too_large'; END IF;
 FOR batch IN SELECT value FROM jsonb_array_elements(p_writes) LOOP
  target:=batch->>'target';
  IF target NOT IN ('api_football_data','competitions','clubs','official_leagues','official_teams','official_events','players') THEN RAISE EXCEPTION 'queue_target_denied'; END IF;
  keys:=CASE WHEN target='api_football_data' THEN ARRAY['kind','ref'] WHEN target IN ('clubs','competitions') THEN ARRAY['id'] WHEN target='players' THEN ARRAY['source','source_id'] ELSE ARRAY['source_id'] END;
  FOR rowdata IN SELECT value FROM jsonb_array_elements(batch->'rows') LOOP
   IF (target IN ('clubs','competitions') AND coalesce(rowdata->>'id','') !~ '^af[0-9]+$')
   OR (target='players' AND (rowdata->>'source' IS DISTINCT FROM 'api-football' OR coalesce(rowdata->>'source_id','') !~ '^[0-9]+$'))
   OR (target IN ('official_leagues','official_teams','official_events') AND coalesce(rowdata->>'source_id','') !~ '^af:[0-9]+$') THEN RAISE EXCEPTION 'queue_identity_denied'; END IF;
   SELECT string_agg(format('%I IS NOT DISTINCT FROM %L',k,rowdata->>k),' AND ' ORDER BY k) INTO predicate FROM unnest(keys) k;
   PERFORM pg_advisory_xact_lock(hashtextextended(target||predicate,0));
   EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE %s FOR UPDATE',target,predicate) INTO previous;
   IF previous IS NOT NULL AND (target IN ('clubs','competitions') OR previous @> (rowdata-'updated_at')) THEN n_same:=n_same+1; CONTINUE; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(rowdata) k WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=format('public.%I',target)::regclass AND attname=k AND attnum>0 AND NOT attisdropped AND attgenerated='')) THEN RAISE EXCEPTION 'queue_column_denied'; END IF;
   SELECT string_agg(format('%I',k),',' ORDER BY k),string_agg(format('%I=EXCLUDED.%I',k,k),',' ORDER BY k) INTO cols,updates FROM jsonb_object_keys(rowdata) k;
   SELECT string_agg(format('%I',k),',' ORDER BY k) INTO vals FROM unnest(keys) k;
   EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) ON CONFLICT(%s) DO UPDATE SET %s',target,cols,cols,target,vals,updates) USING rowdata;
   IF previous IS NULL THEN n_insert:=n_insert+1; ELSE n_update:=n_update+1; END IF;
  END LOOP;
 END LOOP;
 INSERT INTO football_import_private.jobs(path,kind,meta,priority)
 SELECT x.path,x.kind,x.meta,x.priority FROM jsonb_to_recordset(p_children) x(path text,kind text,meta jsonb,priority integer)
 ON CONFLICT(path) DO NOTHING;
 INSERT INTO football_import_private.receipts(path,received,inserted,updated,unchanged,skipped,provider_requests,remaining_quota)
 VALUES(p_path,p_received,n_insert,n_update,n_same,n_skip,p_requests,p_remaining) RETURNING to_jsonb(receipts.*) INTO result;
 UPDATE football_import_private.jobs SET status='done',received=p_received,error=NULL,completed_at=now(),lease_until=NULL,lease_token=NULL,cached_body=NULL WHERE path=p_path;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.football_queue_defer(p_path text,p_lease uuid,p_code text,p_wait integer,p_budget boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE football_import_private.jobs SET status=CASE WHEN p_budget THEN 'pending' ELSE 'failed' END,
 attempts=greatest(0,attempts-CASE WHEN p_budget THEN 1 ELSE 0 END),error=CASE WHEN p_budget THEN NULL ELSE left(p_code,120) END,
 retry_at=now()+make_interval(secs=>greatest(1,least(p_wait,86400))),lease_token=NULL,lease_until=NULL
 WHERE path=p_path AND lease_token=p_lease AND status='running';
 IF p_code IN ('football_daily_quota_wait','provider_daily_quota') THEN
 UPDATE football_import_private.settings SET next_run_at=(date_trunc('day',now() AT TIME ZONE 'UTC')+interval '1 day') AT TIME ZONE 'UTC' WHERE singleton;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.football_queue_status()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('coverage',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT kind,status,count(*) jobs FROM football_import_private.jobs GROUP BY kind,status ORDER BY kind,status)x),
 'receipts',(SELECT jsonb_build_object('jobs',count(*),'received',coalesce(sum(received),0),'inserted',coalesce(sum(inserted),0),'updated',coalesce(sum(updated),0),'unchanged',coalesce(sum(unchanged),0),'skipped',coalesce(sum(skipped),0),'requests',coalesce(sum(provider_requests),0)) FROM football_import_private.receipts),
 'settings',(SELECT jsonb_build_object('enabled',enabled,'nextRunAt',next_run_at,'cutoff',cutoff,'dailyLimit',daily_limit,'minuteLimit',minute_limit,'lastWindowAt',last_window_at,'lastWindow',last_window) FROM football_import_private.settings WHERE singleton));
$$;

CREATE OR REPLACE FUNCTION public.football_queue_window(p_summary jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE football_import_private.settings SET last_window_at=now(),last_window=p_summary WHERE singleton;
$$;

CREATE OR REPLACE FUNCTION public.football_queue_activate(p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_enabled AND NOT EXISTS(SELECT 1 FROM football_import_private.settings WHERE api_key_secret IS NOT NULL AND worker_secret IS NOT NULL AND project_url IS NOT NULL) THEN RAISE EXCEPTION 'queue_not_configured'; END IF;
 UPDATE football_import_private.settings SET enabled=p_enabled WHERE singleton;
 RETURN p_enabled;
END $$;

CREATE OR REPLACE FUNCTION football_import_private.invoke_worker()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s football_import_private.settings%ROWTYPE; token text; request_id bigint;
BEGIN
 SELECT * INTO s FROM football_import_private.settings WHERE singleton;
 IF NOT s.enabled OR s.next_run_at>now() THEN RETURN NULL; END IF;
 SELECT decrypted_secret INTO token FROM vault.decrypted_secrets WHERE id=s.worker_secret;
 SELECT net.http_post(url:=s.project_url||'/functions/v1/api-football-import',headers:=jsonb_build_object('content-type','application/json','x-football-worker',token),body:='{"action":"run"}'::jsonb,timeout_milliseconds:=55000) INTO request_id;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION football_import_private.invoke_worker() FROM PUBLIC,anon,authenticated;
-- Explicit grants; PostgREST exposes functions, never the private queue tables.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'football_queue_%' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;

