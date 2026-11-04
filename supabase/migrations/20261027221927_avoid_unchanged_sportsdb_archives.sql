-- Preserve the exact original sportsdb_save_records body and privileges.
-- The archive conflict used to UPDATE even if the computed values were unchanged.
-- This generates unnecessary WAL, index pressure and heap churn.
-- Based on immutable migration 20261004002003; verify prod function hash before deploy.
-- pg_proc.prosrc (production baseline): 2b470d06ab06f37b2949bf33291e5c8b
-- Fail closed if a concurrent production change modified the function.
DO $verify$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_catalog.pg_proc
      WHERE oid='public.sportsdb_save_records(jsonb)'::pg_catalog.regprocedure)
      IS DISTINCT FROM '2b470d06ab06f37b2949bf33291e5c8b'
  THEN
    RAISE EXCEPTION 'sportsdb_save_records definition changed; rebase optimization';
  END IF;
END
$verify$;

CREATE OR REPLACE FUNCTION public.sportsdb_save_records(p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved integer;
BEGIN
  saved := coalesce(jsonb_array_length(p_rows),0);

  INSERT INTO public.sportsdb_archives(archive_key,source_updated_at)
  SELECT payload->>'archiveKey',max(source_updated_at)
  FROM jsonb_to_recordset(p_rows) AS x(payload jsonb,source_updated_at timestamptz)
  WHERE payload->>'archiveKey' LIKE 'sportsdb/v2/%'
  GROUP BY payload->>'archiveKey'
  ON CONFLICT (archive_key) DO UPDATE SET
    status=CASE WHEN excluded.source_updated_at>public.sportsdb_archives.source_updated_at
      THEN 'pending' ELSE public.sportsdb_archives.status END,
    source_updated_at=greatest(excluded.source_updated_at,public.sportsdb_archives.source_updated_at)
  WHERE public.sportsdb_archives.source_updated_at IS DISTINCT FROM
    greatest(excluded.source_updated_at,public.sportsdb_archives.source_updated_at)
    OR (
      excluded.source_updated_at > public.sportsdb_archives.source_updated_at
      AND public.sportsdb_archives.status IS DISTINCT FROM 'pending'
    );

  INSERT INTO public.official_leagues(source_id,name,sport,country,current_season,source_updated_at)
  SELECT DISTINCT ON (source_id) source_id,public.sportsdb_clean_text(payload->>'strLeague'),
    coalesce(public.sportsdb_clean_text(payload->>'strSport'),'Unknown'),
    public.sportsdb_clean_text(payload->>'strCountry'),
    public.sportsdb_clean_text(payload->>'strCurrentSeason'),source_updated_at
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,source_updated_at timestamptz,payload jsonb)
  WHERE entity_type IN ('league','league_index')
    AND public.sportsdb_clean_text(payload->>'strLeague') IS NOT NULL
    AND (public.sportsdb_clean_text(payload->>'strSport') IS NULL OR lower(public.sportsdb_clean_text(payload->>'strSport'))='soccer')
  ORDER BY source_id,source_updated_at DESC NULLS LAST
  ON CONFLICT (source_id) DO UPDATE SET
    name=excluded.name,
    sport=CASE WHEN excluded.sport='Unknown' THEN public.official_leagues.sport ELSE excluded.sport END,
    country=coalesce(excluded.country,public.official_leagues.country),
    current_season=coalesce(excluded.current_season,public.official_leagues.current_season),
    source_updated_at=coalesce(excluded.source_updated_at,public.official_leagues.source_updated_at),
    updated_at=now()
  WHERE excluded.source_updated_at IS NOT NULL
    AND (public.official_leagues.source_updated_at IS NULL
      OR excluded.source_updated_at >= public.official_leagues.source_updated_at);

  INSERT INTO public.official_teams(source_id,league_source_id,name,venue_source_id,sport,source_updated_at)
  SELECT DISTINCT ON (x.source_id) x.source_id,
    coalesce(nullif(x.payload->>'idLeague',''),nullif(x.parent_id,'')),
    public.sportsdb_clean_text(x.payload->>'strTeam'),nullif(x.payload->>'idVenue',''),
    coalesce(public.sportsdb_clean_text(x.payload->>'strSport'),
      CASE WHEN l.sport='Soccer' THEN 'Soccer' ELSE 'Unknown' END),
    x.source_updated_at
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,parent_id text,source_updated_at timestamptz,payload jsonb)
  LEFT JOIN public.official_leagues l
    ON l.source_id=coalesce(nullif(x.payload->>'idLeague',''),nullif(x.parent_id,''))
  WHERE x.entity_type IN ('team','team_index')
    AND public.sportsdb_clean_text(x.payload->>'strTeam') IS NOT NULL
    AND (public.sportsdb_clean_text(x.payload->>'strSport') IS NULL OR lower(public.sportsdb_clean_text(x.payload->>'strSport'))='soccer')
  ORDER BY x.source_id,x.source_updated_at DESC NULLS LAST
  ON CONFLICT (source_id) DO UPDATE SET
    name=excluded.name,
    league_source_id=coalesce(excluded.league_source_id,public.official_teams.league_source_id),
    venue_source_id=coalesce(excluded.venue_source_id,public.official_teams.venue_source_id),
    sport=CASE WHEN excluded.sport='Unknown' THEN public.official_teams.sport ELSE excluded.sport END,
    source_updated_at=coalesce(excluded.source_updated_at,public.official_teams.source_updated_at),
    updated_at=now()
  WHERE excluded.source_updated_at IS NOT NULL
    AND (public.official_teams.source_updated_at IS NULL
      OR excluded.source_updated_at >= public.official_teams.source_updated_at);

  INSERT INTO public.official_players(source_id,team_source_id,name,position,birth_date,nationality,photo_url,
    sport,team_source_is_explicit,team_source_priority,source_updated_at)
  SELECT DISTINCT ON (x.source_id) x.source_id,
    coalesce(CASE WHEN o.team_source_id_locked THEN o.team_source_id_override END,
      nullif(x.payload->>'idTeam',''),nullif(x.parent_id,'')),
    public.sportsdb_clean_text(x.payload->>'strPlayer'),
    public.sportsdb_clean_text(x.payload->>'strPosition'),
    CASE WHEN o.birth_date_locked THEN o.birth_date_override
      ELSE public.sportsdb_safe_birth_date(x.payload->>'dateBorn',
        coalesce(public.sportsdb_clean_text(x.payload->>'strSport'),t.sport,'Unknown')) END,
    public.sportsdb_clean_text(x.payload->>'strNationality'),
    coalesce(nullif(x.payload->>'strCutout',''),nullif(x.payload->>'strThumb','')),
    coalesce(public.sportsdb_clean_text(x.payload->>'strSport'),t.sport,'Unknown'),
    coalesce(o.team_source_id_locked,false) OR nullif(x.payload->>'idTeam','') IS NOT NULL,
    CASE WHEN coalesce(o.team_source_id_locked,false) THEN 4
      WHEN nullif(x.payload->>'idTeam','') IS NOT NULL AND x.entity_type='player' THEN 3
      WHEN nullif(x.payload->>'idTeam','') IS NOT NULL THEN 2
      WHEN nullif(x.parent_id,'') IS NOT NULL THEN 1 ELSE 0 END,
    x.source_updated_at
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,parent_id text,source_updated_at timestamptz,payload jsonb)
  LEFT JOIN public.sportsdb_player_overrides o ON o.source_id=x.source_id
  LEFT JOIN public.official_teams t
    ON t.source_id=coalesce(CASE WHEN o.team_source_id_locked THEN o.team_source_id_override END,
      nullif(x.payload->>'idTeam',''),nullif(x.parent_id,''))
  WHERE x.entity_type IN ('player','player_index')
    AND public.sportsdb_clean_text(x.payload->>'strPlayer') IS NOT NULL
    AND (public.sportsdb_clean_text(x.payload->>'strSport') IS NULL OR lower(public.sportsdb_clean_text(x.payload->>'strSport'))='soccer')
  ORDER BY x.source_id,x.source_updated_at DESC NULLS LAST,
    (nullif(x.payload->>'idTeam','') IS NOT NULL) DESC,x.parent_id
  ON CONFLICT (source_id) DO UPDATE SET
    name=excluded.name,
    team_source_id=CASE
      WHEN EXISTS(SELECT 1 FROM public.sportsdb_player_overrides o
        WHERE o.source_id=excluded.source_id AND o.team_source_id_locked)
        THEN (SELECT o.team_source_id_override FROM public.sportsdb_player_overrides o
          WHERE o.source_id=excluded.source_id AND o.team_source_id_locked)
      WHEN excluded.team_source_priority > public.official_players.team_source_priority
        OR (excluded.team_source_priority = public.official_players.team_source_priority
          AND (public.official_players.source_updated_at IS NULL
            OR excluded.source_updated_at >= public.official_players.source_updated_at))
        THEN coalesce(excluded.team_source_id,public.official_players.team_source_id)
      ELSE public.official_players.team_source_id
    END,
    team_source_is_explicit=public.official_players.team_source_is_explicit OR excluded.team_source_is_explicit,
    team_source_priority=greatest(public.official_players.team_source_priority,excluded.team_source_priority),
    position=coalesce(excluded.position,public.official_players.position),
    birth_date=CASE
      WHEN EXISTS(SELECT 1 FROM public.sportsdb_player_overrides o
        WHERE o.source_id=excluded.source_id AND o.birth_date_locked)
        THEN (SELECT o.birth_date_override FROM public.sportsdb_player_overrides o
          WHERE o.source_id=excluded.source_id AND o.birth_date_locked)
      ELSE coalesce(excluded.birth_date,public.official_players.birth_date)
    END,
    nationality=coalesce(excluded.nationality,public.official_players.nationality),
    photo_url=coalesce(excluded.photo_url,public.official_players.photo_url),
    sport=CASE WHEN excluded.sport='Unknown' THEN public.official_players.sport ELSE excluded.sport END,
    source_updated_at=coalesce(excluded.source_updated_at,public.official_players.source_updated_at),
    updated_at=now()
  WHERE excluded.source_updated_at IS NOT NULL
    AND (public.official_players.source_updated_at IS NULL
      OR excluded.source_updated_at >= public.official_players.source_updated_at);

  INSERT INTO public.official_seasons(league_source_id,season,source_updated_at)
  SELECT DISTINCT ON (parent_id,coalesce(nullif(payload->>'strSeason',''),source_id))
    parent_id,coalesce(nullif(payload->>'strSeason',''),source_id),source_updated_at
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,parent_id text,source_updated_at timestamptz,payload jsonb)
  WHERE entity_type='season' AND parent_id<>''
  ORDER BY parent_id,coalesce(nullif(payload->>'strSeason',''),source_id),source_updated_at DESC NULLS LAST
  ON CONFLICT (league_source_id,season) DO UPDATE SET
    source_updated_at=coalesce(excluded.source_updated_at,public.official_seasons.source_updated_at),updated_at=now()
  WHERE excluded.source_updated_at IS NOT NULL
    AND (public.official_seasons.source_updated_at IS NULL
      OR excluded.source_updated_at >= public.official_seasons.source_updated_at);

  INSERT INTO public.official_equipment(source_id,team_source_id,season,kind,image_url,source_updated_at)
  SELECT DISTINCT ON (x.source_id) x.source_id,coalesce(nullif(x.payload->>'idTeam',''),nullif(x.parent_id,'')),
    x.payload->>'strSeason',x.payload->>'strType',x.payload->>'strEquipment',x.source_updated_at
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,parent_id text,source_updated_at timestamptz,payload jsonb)
  WHERE entity_type='equipment'
  ORDER BY x.source_id,x.source_updated_at DESC NULLS LAST
  ON CONFLICT (source_id) DO UPDATE SET
    team_source_id=excluded.team_source_id,season=excluded.season,kind=excluded.kind,image_url=excluded.image_url,
    source_updated_at=coalesce(excluded.source_updated_at,public.official_equipment.source_updated_at),updated_at=now()
  WHERE excluded.source_updated_at IS NOT NULL
    AND (public.official_equipment.source_updated_at IS NULL
      OR excluded.source_updated_at >= public.official_equipment.source_updated_at);

  INSERT INTO public.official_venues(source_id,name,city,country,capacity,photo_url,source_updated_at)
  SELECT DISTINCT ON (x.source_id) x.source_id,
    coalesce(public.sportsdb_clean_text(x.payload->>'strVenue'),public.sportsdb_clean_text(x.payload->>'strStadium')),
    public.sportsdb_clean_text(x.payload->>'strCity'),public.sportsdb_clean_text(x.payload->>'strCountry'),
    CASE WHEN x.payload->>'intCapacity' ~ '^[0-9]{1,6}$' THEN (x.payload->>'intCapacity')::integer END,
    x.payload->>'strThumb',x.source_updated_at
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,source_updated_at timestamptz,payload jsonb)
  WHERE entity_type='venue'
    AND coalesce(public.sportsdb_clean_text(x.payload->>'strVenue'),public.sportsdb_clean_text(x.payload->>'strStadium')) IS NOT NULL
  ORDER BY x.source_id,x.source_updated_at DESC NULLS LAST
  ON CONFLICT (source_id) DO UPDATE SET
    name=excluded.name,city=excluded.city,country=excluded.country,capacity=excluded.capacity,photo_url=excluded.photo_url,
    source_updated_at=coalesce(excluded.source_updated_at,public.official_venues.source_updated_at),updated_at=now()
  WHERE excluded.source_updated_at IS NOT NULL
    AND (public.official_venues.source_updated_at IS NULL
      OR excluded.source_updated_at >= public.official_venues.source_updated_at);

  INSERT INTO public.official_events(source_id,league_source_id,season,home_team_source_id,away_team_source_id,
    home_team_name,away_team_name,starts_at,home_score,away_score,status,venue_source_id,venue_name,source_updated_at)
  SELECT DISTINCT ON (x.source_id) x.source_id,x.payload->>'idLeague',
    coalesce(nullif(x.payload->>'strSeason',''),nullif(x.season,'')),x.payload->>'idHomeTeam',x.payload->>'idAwayTeam',
    public.sportsdb_clean_text(x.payload->>'strHomeTeam'),public.sportsdb_clean_text(x.payload->>'strAwayTeam'),
    coalesce(public.sportsdb_bridge_timestamp(nullif(x.payload->>'strTimestamp','')),
      public.sportsdb_bridge_timestamp(nullif(x.payload->>'dateEvent','')||'T'||
        coalesce(nullif(x.payload->>'strTime',''),'00:00:00')||'Z')),
    CASE WHEN x.payload->>'intHomeScore' ~ '^[0-9]{1,2}$' THEN (x.payload->>'intHomeScore')::integer END,
    CASE WHEN x.payload->>'intAwayScore' ~ '^[0-9]{1,2}$' THEN (x.payload->>'intAwayScore')::integer END,
    x.payload->>'strStatus',x.payload->>'idVenue',public.sportsdb_clean_text(x.payload->>'strVenue'),x.source_updated_at
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,season text,source_updated_at timestamptz,payload jsonb)
  WHERE entity_type IN ('event','event_index','round','livescore')
    AND nullif(x.payload->>'idLeague','') IS NOT NULL
    AND coalesce(nullif(x.payload->>'strSeason',''),nullif(x.season,'')) IS NOT NULL
  ORDER BY x.source_id,x.source_updated_at DESC NULLS LAST
  ON CONFLICT (source_id) DO UPDATE SET
    league_source_id=excluded.league_source_id,season=excluded.season,
    home_team_source_id=excluded.home_team_source_id,away_team_source_id=excluded.away_team_source_id,
    home_team_name=excluded.home_team_name,away_team_name=excluded.away_team_name,
    starts_at=coalesce(excluded.starts_at,public.official_events.starts_at),
    home_score=excluded.home_score,away_score=excluded.away_score,status=excluded.status,
    venue_source_id=excluded.venue_source_id,venue_name=excluded.venue_name,
    source_updated_at=coalesce(excluded.source_updated_at,public.official_events.source_updated_at),updated_at=now()
  WHERE excluded.source_updated_at IS NOT NULL
    AND (public.official_events.source_updated_at IS NULL
      OR excluded.source_updated_at >= public.official_events.source_updated_at);

  INSERT INTO public.official_event_details(event_source_id,detail_type,source_id,team_source_id,player_source_id,label,payload,source_updated_at)
  SELECT DISTINCT ON (x.parent_id,x.entity_type,x.source_id) x.parent_id,replace(x.entity_type,'event_',''),
    x.source_id,x.payload->>'idTeam',x.payload->>'idPlayer',
    coalesce(x.payload->>'strTimeline',x.payload->>'strStatistic',x.payload->>'strPlayer'),x.payload,x.source_updated_at
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,parent_id text,source_updated_at timestamptz,payload jsonb)
  WHERE x.entity_type IN ('event_lineup','event_results','event_stats','event_timeline','event_tv','event_highlights')
    AND EXISTS(SELECT 1 FROM public.official_events e WHERE e.source_id=x.parent_id)
  ORDER BY x.parent_id,x.entity_type,x.source_id,x.source_updated_at DESC NULLS LAST
  ON CONFLICT (event_source_id,detail_type,source_id) DO UPDATE SET
    payload=excluded.payload,team_source_id=excluded.team_source_id,player_source_id=excluded.player_source_id,
    label=excluded.label,
    source_updated_at=coalesce(excluded.source_updated_at,public.official_event_details.source_updated_at),updated_at=now()
  WHERE excluded.source_updated_at IS NOT NULL
    AND (public.official_event_details.source_updated_at IS NULL
      OR excluded.source_updated_at >= public.official_event_details.source_updated_at);

  INSERT INTO public.official_media(source,entity_type,source_id,parent_source_id,kind,url,source_updated_at)
  SELECT DISTINCT ON (x.entity_type,x.source_id,m.key) 'thesportsdb',
    replace(x.entity_type,'_index',''),
    CASE WHEN replace(x.entity_type,'_index','')='player'
      THEN coalesce(a.canonical_source_id,x.source_id) ELSE x.source_id END,
    CASE WHEN replace(x.entity_type,'_index','')='season' THEN coalesce(nullif(x.parent_id,''),'') ELSE '' END,
    lower(substring(m.key from 4)),m.value,x.source_updated_at
  FROM jsonb_to_recordset(p_rows) AS x(entity_type text,source_id text,parent_id text,source_updated_at timestamptz,payload jsonb)
  CROSS JOIN LATERAL jsonb_each_text(x.payload) m
  LEFT JOIN public.sportsdb_player_aliases a ON a.alias_source_id=x.source_id
  WHERE m.key IN ('strBadge','strLogo','strTrophy','strPoster','strBanner','strFanart','strFanart1','strFanart2',
    'strFanart3','strFanart4','strThumb','strCutout','strRender','strEquipment')
    AND m.value LIKE 'https://%'
  ORDER BY x.entity_type,x.source_id,m.key,x.source_updated_at DESC NULLS LAST
  ON CONFLICT (source,entity_type,source_id,parent_source_id,kind) DO UPDATE SET
    url=excluded.url,
    source_updated_at=coalesce(excluded.source_updated_at,public.official_media.source_updated_at),
    updated_at=now()
  WHERE excluded.source_updated_at IS NOT NULL
    AND (public.official_media.source_updated_at IS NULL
      OR excluded.source_updated_at >= public.official_media.source_updated_at);

  RETURN saved;
END $$;
REVOKE ALL ON FUNCTION public.sportsdb_save_records(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sportsdb_save_records(jsonb) TO service_role;
