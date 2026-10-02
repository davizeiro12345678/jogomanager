-- Copies the user's existing premium TheSportsDB import from Cloudflare to Supabase.
-- Source JSON and import credentials remain private. Game-domain rows are preserved.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.sportsdb_bridge_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT true,
  token_sha256 text NOT NULL,
  lease_owner uuid,
  lease_until timestamptz,
  source_status jsonb NOT NULL DEFAULT '{}',
  source_complete boolean NOT NULL DEFAULT false,
  max_database_bytes bigint NOT NULL DEFAULT 471859200,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sportsdb_import_cursors (
  entity_type text PRIMARY KEY,
  next_offset bigint NOT NULL DEFAULT 0,
  source_total bigint NOT NULL DEFAULT 0,
  fingerprint text NOT NULL,
  priority integer NOT NULL,
  status text NOT NULL DEFAULT 'copying',
  last_serviced_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sportsdb_records (
  source text NOT NULL DEFAULT 'thesportsdb' CHECK (source = 'thesportsdb'),
  entity_type text NOT NULL CHECK (entity_type ~ '^[a-z_]{1,40}$'),
  source_id text NOT NULL,
  parent_id text NOT NULL DEFAULT '',
  season text NOT NULL DEFAULT '',
  payload jsonb NOT NULL,
  source_updated_at timestamptz NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, entity_type, source_id, parent_id, season)
);
CREATE INDEX sportsdb_records_parent_idx ON public.sportsdb_records(entity_type, parent_id, source_id);
CREATE TABLE public.sportsdb_archives (
  archive_key text PRIMARY KEY CHECK (archive_key LIKE 'sportsdb/v2/%' AND position('..' in archive_key) = 0),
  source_updated_at timestamptz NOT NULL,
  hydrated_at timestamptz,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text
);
CREATE INDEX sportsdb_archives_pending_idx ON public.sportsdb_archives(status, retry_at, archive_key);

CREATE TABLE public.official_players (
  source_id text PRIMARY KEY,
  team_source_id text,
  name text NOT NULL,
  position text,
  birth_date text,
  nationality text,
  photo_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX official_players_team_idx ON public.official_players(team_source_id);
CREATE TABLE public.official_venues (
  source_id text PRIMARY KEY,
  name text NOT NULL,
  city text,
  country text,
  capacity integer,
  photo_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.official_seasons (
  league_source_id text NOT NULL,
  season text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_source_id, season)
);
CREATE TABLE public.official_equipment (
  source_id text PRIMARY KEY,
  team_source_id text,
  season text,
  kind text,
  image_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX official_equipment_team_idx ON public.official_equipment(team_source_id);

DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['sportsdb_bridge_control','sportsdb_import_cursors','sportsdb_records','sportsdb_archives',
    'official_players','official_venues','official_seasons','official_equipment'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tab);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', tab);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tab);
    IF tab LIKE 'official_%' THEN
      EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', tab);
      EXECUTE format('CREATE POLICY "Read official football records" ON public.%I FOR SELECT TO anon, authenticated USING (true)', tab);
    END IF;
  END LOOP;
END $$;

DO $$ DECLARE token text; BEGIN
  token := encode(extensions.gen_random_bytes(32), 'hex');
  PERFORM vault.create_secret(token, 'sportsdb_bridge_scheduler_token', 'Private token for the football database import');
  INSERT INTO public.sportsdb_bridge_control(token_sha256)
    VALUES (encode(extensions.digest(token, 'sha256'), 'hex'));
END $$;

CREATE FUNCTION public.sportsdb_bridge_authorize(p_token text) RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.sportsdb_bridge_control
    WHERE token_sha256 = encode(extensions.digest(p_token, 'sha256'), 'hex'));
$$;
CREATE FUNCTION public.sportsdb_bridge_acquire() RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE owner uuid; BEGIN
  UPDATE public.sportsdb_bridge_control SET lease_owner=gen_random_uuid(),
    lease_until=now()+interval '150 seconds', status='running', updated_at=now()
  WHERE singleton AND enabled AND (lease_until IS NULL OR lease_until < now())
    AND pg_database_size(current_database()) < max_database_bytes
  RETURNING lease_owner INTO owner;
  IF owner IS NULL THEN
    UPDATE public.sportsdb_bridge_control SET enabled=false, status='paused_capacity',
      last_error='Database reached the configured free-plan safety threshold', updated_at=now()
    WHERE singleton AND enabled AND pg_database_size(current_database()) >= max_database_bytes;
  END IF;
  RETURN owner;
END $$;

CREATE FUNCTION public.sportsdb_bridge_manifest(p_owner uuid, p_manifest jsonb,
  p_source_status jsonb, p_source_complete boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.sportsdb_bridge_control WHERE lease_owner=p_owner AND lease_until>now()) THEN
    RAISE EXCEPTION 'Import lease expired';
  END IF;
  UPDATE public.sportsdb_bridge_control SET source_status=p_source_status,
    source_complete=p_source_complete, updated_at=now() WHERE lease_owner=p_owner;
  INSERT INTO public.sportsdb_import_cursors(entity_type,source_total,fingerprint,priority)
  SELECT entity_type, source_total, fingerprint, priority FROM jsonb_to_recordset(p_manifest)
    AS x(entity_type text, source_total bigint, fingerprint text, priority integer)
  ON CONFLICT (entity_type) DO UPDATE SET
    next_offset=CASE WHEN sportsdb_import_cursors.status='caught_up'
      AND sportsdb_import_cursors.fingerprint<>excluded.fingerprint THEN 0 ELSE sportsdb_import_cursors.next_offset END,
    status=CASE WHEN sportsdb_import_cursors.fingerprint<>excluded.fingerprint THEN 'copying' ELSE sportsdb_import_cursors.status END,
    fingerprint=CASE WHEN sportsdb_import_cursors.status='caught_up' THEN excluded.fingerprint
      ELSE sportsdb_import_cursors.fingerprint END,
    source_total=excluded.source_total, updated_at=now();
END $$;

CREATE FUNCTION public.sportsdb_bridge_timestamp(p_value text) RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE STRICT SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN p_value::timestamptz;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN NULL;
END $$;

CREATE FUNCTION public.sportsdb_save_records(p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved integer; BEGIN
  INSERT INTO public.sportsdb_records(entity_type,source_id,parent_id,season,payload,source_updated_at)
  SELECT DISTINCT ON (entity_type,source_id,parent_id,season)
    entity_type,source_id,parent_id,season,payload,source_updated_at
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,parent_id text,
    season text,payload jsonb,source_updated_at timestamptz)
  WHERE source_id<>''
  ON CONFLICT (source,entity_type,source_id,parent_id,season) DO UPDATE SET
    payload=CASE WHEN excluded.payload ? 'archiveKey' AND NOT sportsdb_records.payload ? 'archiveKey'
      THEN sportsdb_records.payload ELSE excluded.payload END,
    source_updated_at=greatest(excluded.source_updated_at,sportsdb_records.source_updated_at), imported_at=now();
  GET DIAGNOSTICS saved = ROW_COUNT;

  INSERT INTO public.sportsdb_archives(archive_key,source_updated_at)
  SELECT payload->>'archiveKey',max(source_updated_at) FROM jsonb_to_recordset(p_rows)
    AS x(payload jsonb,source_updated_at timestamptz)
  WHERE payload->>'archiveKey' LIKE 'sportsdb/v2/%' GROUP BY payload->>'archiveKey'
  ON CONFLICT (archive_key) DO UPDATE SET
    status=CASE WHEN excluded.source_updated_at>sportsdb_archives.source_updated_at THEN 'pending' ELSE sportsdb_archives.status END,
    source_updated_at=greatest(excluded.source_updated_at,sportsdb_archives.source_updated_at);

  INSERT INTO public.official_leagues(source_id,name,sport,country,current_season)
  SELECT DISTINCT ON (source_id) source_id,payload->>'strLeague','Soccer',payload->>'strCountry',payload->>'strCurrentSeason'
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,payload jsonb)
  WHERE entity_type IN ('league','league_index') AND nullif(payload->>'strLeague','') IS NOT NULL
  ON CONFLICT (source_id) DO UPDATE SET name=excluded.name,
    country=coalesce(excluded.country,official_leagues.country),
    current_season=coalesce(excluded.current_season,official_leagues.current_season),updated_at=now();

  INSERT INTO public.official_teams(source_id,league_source_id,name,venue_source_id)
  SELECT DISTINCT ON (source_id) source_id,coalesce(nullif(payload->>'idLeague',''),nullif(parent_id,'')),
    payload->>'strTeam',nullif(payload->>'idVenue','')
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,parent_id text,payload jsonb)
  WHERE entity_type IN ('team','team_index') AND nullif(payload->>'strTeam','') IS NOT NULL
  ON CONFLICT (source_id) DO UPDATE SET name=excluded.name,
    league_source_id=coalesce(excluded.league_source_id,official_teams.league_source_id),
    venue_source_id=coalesce(excluded.venue_source_id,official_teams.venue_source_id),updated_at=now();

  INSERT INTO public.official_players(source_id,team_source_id,name,position,birth_date,nationality,photo_url)
  SELECT DISTINCT ON (source_id) source_id,coalesce(nullif(payload->>'idTeam',''),nullif(parent_id,'')),
    payload->>'strPlayer',payload->>'strPosition',payload->>'dateBorn',payload->>'strNationality',
    coalesce(nullif(payload->>'strCutout',''),nullif(payload->>'strThumb',''))
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,parent_id text,payload jsonb)
  WHERE entity_type IN ('player','player_index') AND nullif(payload->>'strPlayer','') IS NOT NULL
  ON CONFLICT (source_id) DO UPDATE SET name=excluded.name,
    team_source_id=coalesce(excluded.team_source_id,official_players.team_source_id),
    position=coalesce(excluded.position,official_players.position),
    birth_date=coalesce(excluded.birth_date,official_players.birth_date),
    nationality=coalesce(excluded.nationality,official_players.nationality),
    photo_url=coalesce(excluded.photo_url,official_players.photo_url),updated_at=now();

  INSERT INTO public.official_seasons(league_source_id,season)
  SELECT DISTINCT parent_id,coalesce(nullif(payload->>'strSeason',''),source_id)
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,parent_id text,payload jsonb)
  WHERE entity_type='season' AND parent_id<>''
  ON CONFLICT (league_source_id,season) DO UPDATE SET updated_at=now();

  INSERT INTO public.official_equipment(source_id,team_source_id,season,kind,image_url)
  SELECT DISTINCT ON (source_id) source_id,coalesce(nullif(payload->>'idTeam',''),nullif(parent_id,'')),
    payload->>'strSeason',payload->>'strType',payload->>'strEquipment'
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,parent_id text,payload jsonb)
  WHERE entity_type='equipment'
  ON CONFLICT (source_id) DO UPDATE SET team_source_id=excluded.team_source_id,season=excluded.season,
    kind=excluded.kind,image_url=excluded.image_url,updated_at=now();

  INSERT INTO public.official_venues(source_id,name,city,country,capacity,photo_url)
  SELECT DISTINCT ON (source_id) source_id,coalesce(nullif(payload->>'strVenue',''),payload->>'strStadium'),
    payload->>'strCity',payload->>'strCountry',
    CASE WHEN payload->>'intCapacity' ~ '^[0-9]{1,6}$' THEN (payload->>'intCapacity')::integer END,payload->>'strThumb'
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,payload jsonb)
  WHERE entity_type='venue' AND coalesce(nullif(payload->>'strVenue',''),nullif(payload->>'strStadium','')) IS NOT NULL
  ON CONFLICT (source_id) DO UPDATE SET name=excluded.name,city=excluded.city,country=excluded.country,
    capacity=excluded.capacity,photo_url=excluded.photo_url,updated_at=now();

  INSERT INTO public.official_events(source_id,league_source_id,season,home_team_source_id,away_team_source_id,
    home_team_name,away_team_name,starts_at,home_score,away_score,status,venue_source_id,venue_name)
  SELECT DISTINCT ON (source_id) source_id,payload->>'idLeague',
    coalesce(nullif(payload->>'strSeason',''),nullif(season,'')),payload->>'idHomeTeam',payload->>'idAwayTeam',
    payload->>'strHomeTeam',payload->>'strAwayTeam',
    coalesce(public.sportsdb_bridge_timestamp(nullif(payload->>'strTimestamp','')),
      public.sportsdb_bridge_timestamp(nullif(payload->>'dateEvent','') || 'T' ||
        coalesce(nullif(payload->>'strTime',''),'00:00:00') || 'Z')),
    CASE WHEN payload->>'intHomeScore' ~ '^[0-9]{1,2}$' THEN (payload->>'intHomeScore')::integer END,
    CASE WHEN payload->>'intAwayScore' ~ '^[0-9]{1,2}$' THEN (payload->>'intAwayScore')::integer END,
    payload->>'strStatus',payload->>'idVenue',payload->>'strVenue'
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,season text,payload jsonb)
  WHERE entity_type IN ('event','event_index','round','livescore') AND nullif(payload->>'idLeague','') IS NOT NULL
    AND coalesce(nullif(payload->>'strSeason',''),nullif(season,'')) IS NOT NULL
  ON CONFLICT (source_id) DO UPDATE SET league_source_id=excluded.league_source_id,season=excluded.season,
    home_team_source_id=excluded.home_team_source_id,away_team_source_id=excluded.away_team_source_id,
    home_team_name=excluded.home_team_name,away_team_name=excluded.away_team_name,
    starts_at=coalesce(excluded.starts_at,official_events.starts_at),home_score=excluded.home_score,
    away_score=excluded.away_score,status=excluded.status,venue_source_id=excluded.venue_source_id,
    venue_name=excluded.venue_name,updated_at=now();

  INSERT INTO public.official_event_details(event_source_id,detail_type,source_id,team_source_id,player_source_id,label,payload)
  SELECT DISTINCT ON (parent_id,entity_type,source_id) parent_id,replace(entity_type,'event_',''),
    source_id,payload->>'idTeam',payload->>'idPlayer',
    coalesce(payload->>'strTimeline',payload->>'strStatistic',payload->>'strPlayer'),payload
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,parent_id text,payload jsonb)
  WHERE entity_type IN ('event_lineup','event_results','event_stats','event_timeline','event_tv','event_highlights')
    AND EXISTS(SELECT 1 FROM public.official_events e WHERE e.source_id=x.parent_id)
  ON CONFLICT (event_source_id,detail_type,source_id) DO UPDATE SET payload=excluded.payload,
    team_source_id=excluded.team_source_id,player_source_id=excluded.player_source_id,label=excluded.label,updated_at=now();

  INSERT INTO public.official_media(source,entity_type,source_id,kind,url)
  SELECT DISTINCT ON (x.entity_type,x.source_id,m.key) 'thesportsdb',
    replace(x.entity_type,'_index',''),x.source_id,lower(substring(m.key from 4)),m.value
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,payload jsonb)
  CROSS JOIN LATERAL jsonb_each_text(x.payload) m
  WHERE m.key IN ('strBadge','strLogo','strTrophy','strPoster','strBanner','strFanart','strFanart1','strFanart2',
    'strFanart3','strFanart4','strThumb','strCutout','strRender','strEquipment') AND m.value LIKE 'https://%'
  ON CONFLICT (source,entity_type,source_id,kind) DO UPDATE SET url=excluded.url,updated_at=now();
  RETURN saved;
END $$;

CREATE FUNCTION public.sportsdb_bridge_work(p_owner uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE task jsonb; jobs jsonb; paused boolean; BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.sportsdb_bridge_control WHERE lease_owner=p_owner AND lease_until>now()) THEN
    RAISE EXCEPTION 'Import lease expired';
  END IF;
  SELECT pg_database_size(current_database())>=max_database_bytes INTO paused FROM public.sportsdb_bridge_control;
  IF paused THEN
    UPDATE public.sportsdb_bridge_control SET enabled=false,status='paused_capacity',
      last_error='Database reached the configured free-plan safety threshold';
  END IF;
  SELECT to_jsonb(c) INTO task FROM public.sportsdb_import_cursors c WHERE status='copying'
    ORDER BY last_serviced_at NULLS FIRST,priority LIMIT 1;
  SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') INTO jobs FROM (
    SELECT archive_key,source_updated_at FROM public.sportsdb_archives
    WHERE status IN ('pending','retry') AND retry_at<=now()
    ORDER BY (archive_key LIKE 'sportsdb/v2/lookup/league/%') DESC, archive_key LIMIT 4
  ) a;
  RETURN jsonb_build_object('paused',paused,'page',task,'archives',jobs);
END $$;

CREATE FUNCTION public.sportsdb_bridge_page(p_owner uuid,p_entity text,p_offset bigint,
  p_consumed integer,p_total bigint,p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved integer; BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.sportsdb_bridge_control WHERE lease_owner=p_owner AND lease_until>now()) THEN
    RAISE EXCEPTION 'Import lease expired';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.sportsdb_import_cursors WHERE entity_type=p_entity AND next_offset=p_offset) THEN
    RAISE EXCEPTION 'Stale import cursor';
  END IF;
  saved := public.sportsdb_save_records(p_rows);
  UPDATE public.sportsdb_import_cursors SET next_offset=p_offset+p_consumed,
    source_total=p_total,status=CASE WHEN p_offset+p_consumed>=p_total THEN 'caught_up' ELSE 'copying' END,
    last_serviced_at=now(),updated_at=now() WHERE entity_type=p_entity;
  RETURN saved;
END $$;

CREATE FUNCTION public.sportsdb_bridge_archive(p_owner uuid,p_key text,p_updated_at timestamptz,
  p_payload jsonb,p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved integer; BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.sportsdb_bridge_control WHERE lease_owner=p_owner AND lease_until>now()) THEN
    RAISE EXCEPTION 'Import lease expired';
  END IF;
  saved := public.sportsdb_save_records(p_rows);
  UPDATE public.sportsdb_archives SET payload=p_payload,hydrated_at=now(),
    status=CASE WHEN source_updated_at>p_updated_at THEN 'pending' ELSE 'done' END,
    attempts=0,last_error=NULL WHERE archive_key=p_key;
  RETURN saved;
END $$;
CREATE FUNCTION public.sportsdb_bridge_archive_error(p_owner uuid,p_key text,p_error text) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  UPDATE public.sportsdb_archives SET status=CASE WHEN attempts>=4 THEN 'failed' ELSE 'retry' END,
    attempts=attempts+1,last_error=left(p_error,300),retry_at=now()+interval '5 minutes'
  WHERE archive_key=p_key AND EXISTS(SELECT 1 FROM public.sportsdb_bridge_control WHERE lease_owner=p_owner AND lease_until>now());
$$;
CREATE FUNCTION public.sportsdb_bridge_release(p_owner uuid,p_error text) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  UPDATE public.sportsdb_bridge_control SET lease_owner=NULL,lease_until=NULL,
    last_error=coalesce(p_error,last_error),
    status=CASE WHEN NOT enabled THEN status WHEN p_error IS NOT NULL THEN 'retry'
      WHEN source_complete AND NOT EXISTS(SELECT 1 FROM public.sportsdb_import_cursors WHERE status<>'caught_up')
        AND NOT EXISTS(SELECT 1 FROM public.sportsdb_archives WHERE status<>'done') THEN 'complete'
      ELSE 'waiting_for_source_or_copying' END,updated_at=now()
  WHERE lease_owner=p_owner;
$$;

-- Imported functions are privileged because of their callers' grants, never SECURITY DEFINER.
DO $$ DECLARE fn record; BEGIN
  FOR fn IN SELECT p.oid::regprocedure AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (p.proname LIKE 'sportsdb_bridge_%' OR p.proname='sportsdb_save_records') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',fn.name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.name);
  END LOOP;
END $$;
