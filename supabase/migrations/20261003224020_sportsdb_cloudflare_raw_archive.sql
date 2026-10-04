-- The raw SportsDB corpus is already retained in Cloudflare R2 by the source worker.
-- Keep only normalized game catalog rows and compact archive job metadata in Postgres.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sportsdb_bridge_control WHERE lease_owner IS NOT NULL) THEN
    RAISE EXCEPTION 'Pause the SportsDB importer and wait for its lease to clear before compaction';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sportsdb_save_records(p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved integer; BEGIN
  saved := coalesce(jsonb_array_length(p_rows),0);
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

CREATE OR REPLACE FUNCTION public.sportsdb_bridge_archive(p_owner uuid,p_key text,p_updated_at timestamptz,
  p_payload jsonb,p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved integer; BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.sportsdb_bridge_control WHERE lease_owner=p_owner AND lease_until>now()) THEN
    RAISE EXCEPTION 'Import lease expired';
  END IF;
  saved := public.sportsdb_save_records(p_rows);
  UPDATE public.sportsdb_archives SET hydrated_at=now(),
    status=CASE WHEN source_updated_at>p_updated_at THEN 'pending' ELSE 'done' END,
    attempts=0,last_error=NULL WHERE archive_key=p_key;
  RETURN saved;
  END $$;

CREATE TABLE public.sportsdb_archives_compact (
  archive_key text PRIMARY KEY CHECK (archive_key LIKE 'sportsdb/v2/%' AND position('..' in archive_key) = 0),
  source_updated_at timestamptz NOT NULL,
  hydrated_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text
);
CREATE INDEX sportsdb_archives_compact_pending_idx
  ON public.sportsdb_archives_compact(status, retry_at, archive_key);
ALTER TABLE public.sportsdb_archives_compact ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sportsdb_archives_compact FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.sportsdb_archives_compact TO service_role;
CREATE POLICY "Import service only" ON public.sportsdb_archives_compact
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.sportsdb_archives_compact
  (archive_key,source_updated_at,hydrated_at,status,attempts,retry_at,last_error)
SELECT archive_key,source_updated_at,hydrated_at,status,attempts,retry_at,last_error
FROM public.sportsdb_archives;

ALTER TABLE public.sportsdb_archives RENAME TO sportsdb_archives_payload_archive;
ALTER INDEX public.sportsdb_archives_pending_idx RENAME TO sportsdb_archives_payload_pending_idx;
ALTER TABLE public.sportsdb_archives_compact RENAME TO sportsdb_archives;
ALTER INDEX public.sportsdb_archives_compact_pending_idx RENAME TO sportsdb_archives_pending_idx;

DROP TABLE public.sportsdb_archives_payload_archive;
DROP TABLE public.sportsdb_records;
