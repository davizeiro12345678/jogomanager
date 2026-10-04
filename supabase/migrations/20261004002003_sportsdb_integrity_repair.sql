-- Repair SportsDB identity, age, media-grain, sport classification, and freshness.
-- The raw source remains in Cloudflare/R2; every edited value is retained below.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

SELECT 1 FROM public.sportsdb_bridge_control WHERE singleton=true FOR UPDATE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.sportsdb_bridge_control
    WHERE lease_owner IS NOT NULL AND lease_until > now()
  ) THEN
    RAISE EXCEPTION 'Wait for the active SportsDB bridge lease before applying integrity repair';
  END IF;
END $$;

UPDATE public.sportsdb_bridge_control
SET enabled=false, lease_owner=NULL, lease_until=NULL,
    status='paused_integrity_migration', updated_at=now()
WHERE lease_until IS NULL OR lease_until <= now();

CREATE TABLE IF NOT EXISTS public.sportsdb_data_corrections (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  correction_key text NOT NULL,
  table_name text NOT NULL,
  source_id text NOT NULL,
  reason text NOT NULL,
  before_row jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (correction_key, table_name, source_id)
);
ALTER TABLE public.sportsdb_data_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sportsdb_data_corrections FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.sportsdb_data_corrections TO service_role;
DROP POLICY IF EXISTS "SportsDB correction log service only" ON public.sportsdb_data_corrections;
CREATE POLICY "SportsDB correction log service only"
  ON public.sportsdb_data_corrections FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.sportsdb_player_overrides (
  source_id text PRIMARY KEY,
  birth_date_override text,
  birth_date_locked boolean NOT NULL DEFAULT false,
  team_source_id_override text,
  team_source_id_locked boolean NOT NULL DEFAULT false,
  reason text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sportsdb_player_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sportsdb_player_overrides FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.sportsdb_player_overrides TO service_role;
DROP POLICY IF EXISTS "SportsDB player overrides service only" ON public.sportsdb_player_overrides;
CREATE POLICY "SportsDB player overrides service only"
  ON public.sportsdb_player_overrides FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.official_players
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS sport text NOT NULL DEFAULT 'Unknown',
  ADD COLUMN IF NOT EXISTS team_source_is_explicit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS team_source_priority smallint NOT NULL DEFAULT 0;
ALTER TABLE public.official_teams
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS sport text NOT NULL DEFAULT 'Unknown';
ALTER TABLE public.official_leagues
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;
ALTER TABLE public.official_seasons
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;
ALTER TABLE public.official_equipment
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;
ALTER TABLE public.official_venues
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;
ALTER TABLE public.official_events
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;
ALTER TABLE public.official_event_details
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;
ALTER TABLE public.official_media
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS parent_source_id text NOT NULL DEFAULT '';

ALTER TABLE public.official_media DROP CONSTRAINT official_media_pkey;
ALTER TABLE public.official_media
  ADD CONSTRAINT official_media_pkey
  PRIMARY KEY (source, entity_type, source_id, parent_source_id, kind);

CREATE TABLE IF NOT EXISTS public.sportsdb_competition_identity_aliases (
  alias_id text PRIMARY KEY REFERENCES public.competitions(id) ON DELETE CASCADE,
  canonical_id text NOT NULL REFERENCES public.competitions(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (alias_id <> canonical_id)
);
CREATE TABLE IF NOT EXISTS public.sportsdb_club_identity_aliases (
  alias_id text PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
  canonical_id text NOT NULL REFERENCES public.clubs(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (alias_id <> canonical_id)
);
ALTER TABLE public.sportsdb_competition_identity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sportsdb_club_identity_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sportsdb_competition_identity_aliases,
  public.sportsdb_club_identity_aliases FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.sportsdb_competition_identity_aliases,
  public.sportsdb_club_identity_aliases TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS competitions_source_id_uidx
  ON public.competitions(source_id)
  WHERE source_id IS NOT NULL AND btrim(source_id) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS players_source_source_id_uidx
  ON public.players(source,source_id);

INSERT INTO public.sportsdb_data_corrections(correction_key,table_name,source_id,reason,before_row)
SELECT 'normalize-local-name-v1','clubs',c.id,
  'Trim and collapse repeated whitespace without changing club identity or competition membership',to_jsonb(c)
FROM public.clubs c
WHERE c.name IS DISTINCT FROM regexp_replace(btrim(c.name),'[[:space:]]+',' ','g')
   OR c.short_name IS DISTINCT FROM regexp_replace(btrim(c.short_name),'[[:space:]]+',' ','g')
   OR c.full_name IS DISTINCT FROM CASE WHEN c.full_name IS NULL THEN NULL ELSE regexp_replace(btrim(c.full_name),'[[:space:]]+',' ','g') END
ON CONFLICT (correction_key,table_name,source_id) DO NOTHING;
INSERT INTO public.sportsdb_data_corrections(correction_key,table_name,source_id,reason,before_row)
SELECT 'normalize-local-name-v1','competitions',c.id,
  'Trim and collapse repeated whitespace without changing competition identity',to_jsonb(c)
FROM public.competitions c
WHERE c.name IS DISTINCT FROM regexp_replace(btrim(c.name),'[[:space:]]+',' ','g')
   OR c.country IS DISTINCT FROM regexp_replace(btrim(c.country),'[[:space:]]+',' ','g')
ON CONFLICT (correction_key,table_name,source_id) DO NOTHING;
INSERT INTO public.sportsdb_data_corrections(correction_key,table_name,source_id,reason,before_row)
SELECT 'normalize-source-name-v1','official_players',p.source_id,
  'Trim and collapse repeated whitespace in mirrored source names',to_jsonb(p)
FROM public.official_players p
WHERE p.name IS DISTINCT FROM regexp_replace(btrim(p.name),'[[:space:]]+',' ','g')
ON CONFLICT (correction_key,table_name,source_id) DO NOTHING;
INSERT INTO public.sportsdb_data_corrections(correction_key,table_name,source_id,reason,before_row)
SELECT 'normalize-source-name-v1','official_teams',t.source_id,
  'Trim and collapse repeated whitespace in mirrored source names',to_jsonb(t)
FROM public.official_teams t
WHERE t.name IS DISTINCT FROM regexp_replace(btrim(t.name),'[[:space:]]+',' ','g')
ON CONFLICT (correction_key,table_name,source_id) DO NOTHING;
INSERT INTO public.sportsdb_data_corrections(correction_key,table_name,source_id,reason,before_row)
SELECT 'normalize-source-name-v1','official_leagues',l.source_id,
  'Trim and collapse repeated whitespace in mirrored source names',to_jsonb(l)
FROM public.official_leagues l
WHERE l.name IS DISTINCT FROM regexp_replace(btrim(l.name),'[[:space:]]+',' ','g')
ON CONFLICT (correction_key,table_name,source_id) DO NOTHING;

UPDATE public.clubs
SET name=regexp_replace(btrim(name),'[[:space:]]+',' ','g'),
    short_name=regexp_replace(btrim(short_name),'[[:space:]]+',' ','g'),
    full_name=CASE WHEN full_name IS NULL THEN NULL ELSE regexp_replace(btrim(full_name),'[[:space:]]+',' ','g') END
WHERE name IS DISTINCT FROM regexp_replace(btrim(name),'[[:space:]]+',' ','g')
   OR short_name IS DISTINCT FROM regexp_replace(btrim(short_name),'[[:space:]]+',' ','g')
   OR full_name IS DISTINCT FROM CASE WHEN full_name IS NULL THEN NULL ELSE regexp_replace(btrim(full_name),'[[:space:]]+',' ','g') END;
UPDATE public.competitions
SET name=regexp_replace(btrim(name),'[[:space:]]+',' ','g'),
    country=regexp_replace(btrim(country),'[[:space:]]+',' ','g')
WHERE name IS DISTINCT FROM regexp_replace(btrim(name),'[[:space:]]+',' ','g')
   OR country IS DISTINCT FROM regexp_replace(btrim(country),'[[:space:]]+',' ','g');

WITH normalized AS (
  SELECT id, source_id, club_count,
    lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g')) AS name_key,
    lower(regexp_replace(btrim(country),'[[:space:]]+',' ','g')) AS country_key
  FROM public.competitions
), ranked AS (
  SELECT id,
    first_value(id) OVER (
      PARTITION BY name_key,country_key
      ORDER BY club_count DESC,(source_id=id) DESC,char_length(id),id
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS canonical_id,
    row_number() OVER (
      PARTITION BY name_key,country_key
      ORDER BY club_count DESC,(source_id=id) DESC,char_length(id),id
    ) AS position,
    count(*) OVER (PARTITION BY name_key,country_key) AS group_size
  FROM normalized
)
INSERT INTO public.sportsdb_competition_identity_aliases(alias_id,canonical_id,reason)
SELECT id,canonical_id,'same normalized competition name and country; canonical row has the strongest roster count'
FROM ranked WHERE group_size>1 AND position>1
ON CONFLICT (alias_id) DO UPDATE SET canonical_id=excluded.canonical_id;

WITH grouped AS (
  SELECT lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g')) AS name_key,
    lower(regexp_replace(btrim(coalesce(country,'')),'[[:space:]]+',' ','g')) AS country_key,
    count(*) AS group_size,count(DISTINCT competition_id) AS competition_count
  FROM public.clubs
  GROUP BY 1,2
  HAVING count(*)=2 AND count(DISTINCT competition_id)=2
), ranked AS (
  SELECT c.id,
    first_value(c.id) OVER (
      PARTITION BY lower(regexp_replace(btrim(c.name),'[[:space:]]+',' ','g')),
        lower(regexp_replace(btrim(coalesce(c.country,'')),'[[:space:]]+',' ','g'))
      ORDER BY char_length(c.id),c.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS canonical_id,
    row_number() OVER (
      PARTITION BY lower(regexp_replace(btrim(c.name),'[[:space:]]+',' ','g')),
        lower(regexp_replace(btrim(coalesce(c.country,'')),'[[:space:]]+',' ','g'))
      ORDER BY char_length(c.id),c.id
    ) AS position,
    g.group_size
  FROM public.clubs c
  JOIN grouped g
    ON g.name_key=lower(regexp_replace(btrim(c.name),'[[:space:]]+',' ','g'))
   AND g.country_key=lower(regexp_replace(btrim(coalesce(c.country,'')),'[[:space:]]+',' ','g'))
)
INSERT INTO public.sportsdb_club_identity_aliases(alias_id,canonical_id,reason)
SELECT id,canonical_id,'same normalized club name and country in separate competition snapshots; membership rows are preserved'
FROM ranked WHERE group_size=2 AND position>1
ON CONFLICT (alias_id) DO UPDATE SET canonical_id=excluded.canonical_id;

UPDATE public.competitions c SET tier=v.tier
FROM (VALUES
  ('eng2',2),('esp2',2),('ita2',2),('ger2',2),('fra2',2),('por2',2),('tur2',2),
  ('sco2',2),('chi2',2),('uru2',2),('col2',2),('bra2',2),('ned2',2),
  ('x4957',2),('x4913',2),('x5214',2),('x5314',2),('x5313',2),('x4757',2),
  ('x5073',2),('x4640',2),('x5659',2),('x4657',2),('x4824',2),('y4822',2),('y4399',2),
  ('x4397',4),('x5215',3),('x4632',3),('x5885',3),('x4821',3),('x5217',3),
  ('x5481',3),('x5310',3),('x5869',4),('x4670',4),('y5088',3),('y5089',4),
  ('y5090',4),('y5091',4),('y5092',4),('y5539',5),('y5549',5),
  ('y5777',4),('y5778',4),('y5779',4),('y5780',4),('y5781',4),('y5782',4),
  ('y5783',4),('y5784',4),('y4525',2),
  ('y5225',8),('y5226',8),('y5227',8),('y5228',8),
  ('y5325',8),('y5326',8),('y5327',8),('y5328',8)
) AS v(id,tier)
WHERE c.id=v.id AND c.tier IS DISTINCT FROM v.tier;

UPDATE public.official_leagues ol
SET local_competition_id=coalesce(a.canonical_id,c.id)
FROM public.competitions c
LEFT JOIN public.sportsdb_competition_identity_aliases a ON a.alias_id=c.id
WHERE ol.source_id=c.source_id
  AND ol.sport='Soccer'
  AND ol.local_competition_id IS DISTINCT FROM coalesce(a.canonical_id,c.id);

UPDATE public.official_leagues
SET sport='Mixed',updated_at=now()
WHERE source_id='4367' AND name='_No League' AND sport<>'Mixed';

UPDATE public.official_teams t SET sport=CASE
  WHEN t.league_source_id IS DISTINCT FROM '4367' THEN 'Soccer'
  WHEN lower(t.name) IN ('_free agent soccer','_retired soccer') THEN 'Soccer'
  WHEN lower(t.name) LIKE '%fighting%' THEN 'Fighting'
  WHEN lower(t.name) LIKE '%motorsport%' THEN 'Motorsport'
  WHEN lower(t.name) LIKE '%australian football%' OR lower(t.name) LIKE '%ozzy rules%' THEN 'Australian Football'
  WHEN lower(t.name) LIKE '%darts%' THEN 'Darts'
  WHEN lower(t.name) LIKE '%esports%' OR lower(t.name) LIKE '%e-sports%' THEN 'Esports'
  WHEN lower(t.name) LIKE '%field hockey%' OR lower(t.name) LIKE '% hockey%' THEN 'Field Hockey'
  WHEN lower(t.name) LIKE '%handball%' THEN 'Handball'
  WHEN lower(t.name) LIKE '%netball%' THEN 'Netball'
  WHEN lower(t.name) LIKE '%volleyball%' OR lower(t.name) LIKE '% volley%' THEN 'Volleyball'
  WHEN lower(t.name) LIKE '%watersports%' THEN 'Watersports'
  WHEN lower(t.name) LIKE '%rugby%' OR lower(t.name) LIKE '% rfc' THEN 'Rugby'
  WHEN lower(t.name) LIKE '%basketball%' THEN 'Basketball'
  ELSE 'Unknown'
END;
UPDATE public.official_players p
SET sport=coalesce(t.sport,'Unknown')
FROM public.official_teams t
WHERE p.team_source_id=t.source_id AND p.sport IS DISTINCT FROM coalesce(t.sport,'Unknown');
UPDATE public.official_players SET sport='Unknown'
WHERE team_source_id IS NULL AND sport IS DISTINCT FROM 'Unknown';

UPDATE public.official_players
SET name=regexp_replace(btrim(name),'[[:space:]]+',' ','g')
WHERE name IS DISTINCT FROM regexp_replace(btrim(name),'[[:space:]]+',' ','g');
UPDATE public.official_teams
SET name=regexp_replace(btrim(name),'[[:space:]]+',' ','g')
WHERE name IS DISTINCT FROM regexp_replace(btrim(name),'[[:space:]]+',' ','g');
UPDATE public.official_leagues
SET name=regexp_replace(btrim(name),'[[:space:]]+',' ','g')
WHERE name IS DISTINCT FROM regexp_replace(btrim(name),'[[:space:]]+',' ','g');

INSERT INTO public.sportsdb_data_corrections(correction_key,table_name,source_id,reason,before_row)
SELECT 'impossible-football-birth-date-v1','official_players',p.source_id,
  'Known professional or football listing has a birth date implying an age below 15; original is retained in this correction log',
  to_jsonb(p)
FROM public.official_players p
WHERE p.source_id IN ('34163927','34160919','34435321','34165331','34160577','34161776',
  '34161001','34162371','34162190','34163638')
ON CONFLICT (correction_key,table_name,source_id) DO NOTHING;
INSERT INTO public.sportsdb_data_corrections(correction_key,table_name,source_id,reason,before_row)
SELECT 'impossible-football-birth-date-v1','official_players',p.source_id,
  'Football record has a birth year before 1900; original is retained in this correction log',
  to_jsonb(p)
FROM public.official_players p
WHERE p.source_id IN ('34421269','34175825','34438191','34433694')
ON CONFLICT (correction_key,table_name,source_id) DO NOTHING;

INSERT INTO public.sportsdb_player_overrides(source_id,birth_date_override,birth_date_locked,reason)
VALUES
  ('34163927',NULL,true,'Invalid source age on professional football record'),
  ('34160919',NULL,true,'Invalid source age on professional football record'),
  ('34435321',NULL,true,'Invalid source age on professional football record'),
  ('34165331',NULL,true,'Invalid source age on professional football record'),
  ('34160577',NULL,true,'Invalid source age and non-football source category'),
  ('34161776',NULL,true,'Invalid source age on professional football record'),
  ('34161001',NULL,true,'Invalid source age on free-agent football record'),
  ('34162371',NULL,true,'Invalid source age on professional football record'),
  ('34162190',NULL,true,'Invalid source age on national-team football record'),
  ('34163638',NULL,true,'Invalid source age on professional football record'),
  ('34421269',NULL,true,'Invalid birth year for a current football record'),
  ('34175825',NULL,true,'Invalid birth year for a current football record'),
  ('34438191',NULL,true,'Invalid birth year for a current football record'),
  ('34433694',NULL,true,'Invalid birth year for a current football record')
ON CONFLICT (source_id) DO UPDATE
SET birth_date_override=NULL,birth_date_locked=true,reason=excluded.reason,updated_at=now();

INSERT INTO public.sportsdb_data_corrections(correction_key,table_name,source_id,reason,before_row)
SELECT 'wrong-player-team-v1','official_players',p.source_id,
  'Player was assigned to a national team although the archived player record identifies a club team',
  to_jsonb(p)
FROM public.official_players p
WHERE (p.source_id='34145376' AND p.name='Bruno Ecuele Manga' AND p.team_source_id='136478')
   OR (p.source_id='34145427' AND p.name='Joel Campbell' AND p.team_source_id='134505')
ON CONFLICT (correction_key,table_name,source_id) DO NOTHING;

INSERT INTO public.sportsdb_player_overrides(source_id,team_source_id_override,team_source_id_locked,reason)
SELECT p.source_id,v.team_source_id,true,
  'Explicit club-team mapping from archived SportsDB player record'
FROM (VALUES ('34145376','Bruno Ecuele Manga','146312'),
             ('34145427','Joel Campbell','134737')) AS v(source_id,player_name,team_source_id)
JOIN public.official_players p ON p.source_id=v.source_id AND p.name=v.player_name
JOIN public.official_teams t ON t.source_id=v.team_source_id
WHERE (p.source_id='34145376' AND p.team_source_id='136478')
   OR (p.source_id='34145427' AND p.team_source_id='134505')
ON CONFLICT (source_id) DO UPDATE
SET team_source_id_override=excluded.team_source_id_override,
    team_source_id_locked=true,reason=excluded.reason,updated_at=now();

UPDATE public.official_players p
SET birth_date=o.birth_date_override,
    team_source_id=CASE WHEN o.team_source_id_locked THEN o.team_source_id_override ELSE p.team_source_id END,
    team_source_is_explicit=CASE WHEN o.team_source_id_locked THEN true ELSE p.team_source_is_explicit END,
    team_source_priority=CASE WHEN o.team_source_id_locked THEN 4 ELSE p.team_source_priority END,
    updated_at=now()
FROM public.sportsdb_player_overrides o
WHERE p.source_id=o.source_id
  AND (o.birth_date_locked OR o.team_source_id_locked);

INSERT INTO public.sportsdb_data_corrections(correction_key,table_name,source_id,reason,before_row)
SELECT 'alias-player-media-v1','official_media',m.source||':'||m.source_id||':'||m.kind,
  'Player media is attached to a deduplicated alias ID; it is moved to its canonical player ID',
  to_jsonb(m)
FROM public.official_media m
JOIN public.sportsdb_player_aliases a ON a.alias_source_id=m.source_id
WHERE m.entity_type='player'
ON CONFLICT (correction_key,table_name,source_id) DO NOTHING;

INSERT INTO public.official_media(source,entity_type,source_id,parent_source_id,kind,url,updated_at,source_updated_at)
SELECT m.source,m.entity_type,a.canonical_source_id,'',m.kind,m.url,m.updated_at,m.source_updated_at
FROM public.official_media m
JOIN public.sportsdb_player_aliases a ON a.alias_source_id=m.source_id
WHERE m.entity_type='player'
ON CONFLICT (source,entity_type,source_id,parent_source_id,kind) DO UPDATE
SET url=excluded.url,updated_at=greatest(public.official_media.updated_at,excluded.updated_at),
    source_updated_at=coalesce(excluded.source_updated_at,public.official_media.source_updated_at);
UPDATE public.official_players p
SET photo_url=coalesce(a.original_record->>'photo_url',p.photo_url),updated_at=now()
FROM public.sportsdb_player_aliases a
WHERE p.source_id=a.canonical_source_id
  AND nullif(a.original_record->>'photo_url','') IS NOT NULL;
DELETE FROM public.official_media m
USING public.sportsdb_player_aliases a
WHERE m.entity_type='player' AND m.source_id=a.alias_source_id;

WITH unique_seasons AS (
  SELECT season,min(league_source_id) AS league_source_id
  FROM public.official_seasons
  GROUP BY season HAVING count(*)=1
)
UPDATE public.official_media m
SET parent_source_id=s.league_source_id
FROM unique_seasons s
WHERE m.entity_type='season' AND m.parent_source_id='' AND m.source_id=s.season;

INSERT INTO public.sportsdb_data_corrections(correction_key,table_name,source_id,reason,before_row)
SELECT 'ambiguous-season-media-v1','official_media',m.source||':'||m.source_id||':'||m.kind,
  'Season-only media key collides across multiple league-season entities; raw R2 archive will be rehydrated with league scope',
  to_jsonb(m)
FROM public.official_media m
WHERE m.entity_type='season' AND m.parent_source_id=''
  AND EXISTS (
    SELECT 1 FROM public.official_seasons s
    WHERE s.season=m.source_id
    GROUP BY s.season HAVING count(*)>1
  )
ON CONFLICT (correction_key,table_name,source_id) DO NOTHING;
DELETE FROM public.official_media m
WHERE m.entity_type='season' AND m.parent_source_id=''
  AND EXISTS (
    SELECT 1 FROM public.official_seasons s
    WHERE s.season=m.source_id
    GROUP BY s.season HAVING count(*)>1
  );

WITH local_matches AS (
  SELECT t.source_id,c.id AS club_id,count(*) OVER (PARTITION BY t.source_id) AS match_count
  FROM public.official_teams t
  JOIN public.official_leagues l ON l.source_id=t.league_source_id AND l.sport='Soccer'
  JOIN public.clubs c ON c.competition_id=l.local_competition_id
   AND lower(regexp_replace(btrim(c.name),'[[:space:]]+',' ','g'))=
       lower(regexp_replace(btrim(t.name),'[[:space:]]+',' ','g'))
  WHERE t.sport='Soccer' AND t.local_club_id IS NULL
), unique_matches AS (
  SELECT source_id,min(club_id) AS club_id FROM local_matches
  WHERE match_count=1 GROUP BY source_id
)
UPDATE public.official_teams t
SET local_club_id=m.club_id
FROM unique_matches m
WHERE t.source_id=m.source_id AND t.local_club_id IS NULL;

WITH distinct_local_links AS (
  SELECT t.local_club_id,count(DISTINCT t.source_id) AS external_count
  FROM public.official_teams t
  WHERE t.local_club_id IS NOT NULL AND t.sport='Soccer'
  GROUP BY t.local_club_id
), insertable AS (
  SELECT t.local_club_id,t.source_id
  FROM public.official_teams t
  JOIN distinct_local_links d ON d.local_club_id=t.local_club_id AND d.external_count=1
  WHERE t.sport='Soccer'
)
INSERT INTO public.club_external_ids(club_id,source,external_id,confirmed)
SELECT local_club_id,'thesportsdb',source_id,true FROM insertable
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.sportsdb_clean_text(p_value text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT nullif(regexp_replace(btrim(p_value),'[[:space:]]+',' ','g'),'')
$$;

CREATE OR REPLACE FUNCTION public.sportsdb_safe_birth_date(p_value text,p_sport text)
RETURNS text
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE parsed date;
BEGIN
  IF p_value IS NULL THEN RETURN NULL; END IF;
  IF coalesce(p_sport,'Unknown') <> 'Soccer' THEN RETURN p_value; END IF;
  IF p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN NULL; END IF;
  BEGIN
    parsed := p_value::date;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  IF parsed < DATE '1900-01-01' OR parsed > current_date THEN RETURN NULL; END IF;
  RETURN to_char(parsed,'YYYY-MM-DD');
END $$;

CREATE OR REPLACE FUNCTION public.sportsdb_guard_source_freshness()
RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.source_updated_at IS NOT NULL
     AND (NEW.source_updated_at IS NULL OR NEW.source_updated_at < OLD.source_updated_at) THEN
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND NEW.source_updated_at IS NULL THEN
    NEW.source_updated_at := OLD.source_updated_at;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY[
    'players','official_players','official_teams','official_leagues','official_seasons',
    'official_equipment','official_venues','official_events','official_event_details','official_media'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS sportsdb_source_freshness_guard ON public.%I',tab);
    EXECUTE format(
      'CREATE TRIGGER sportsdb_source_freshness_guard BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sportsdb_guard_source_freshness()',
      tab
    );
  END LOOP;
END $$;

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
    source_updated_at=greatest(excluded.source_updated_at,public.sportsdb_archives.source_updated_at);

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

CREATE OR REPLACE FUNCTION public.sportsdb_bridge_archive(p_owner uuid,p_key text,p_updated_at timestamptz,
  p_payload jsonb,p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.sportsdb_bridge_control WHERE lease_owner=p_owner AND lease_until>now()) THEN
    RAISE EXCEPTION 'Import lease expired';
  END IF;
  saved := public.sportsdb_save_records(p_rows);
  UPDATE public.sportsdb_archives SET hydrated_at=now(),
    status=CASE WHEN source_updated_at>p_updated_at THEN 'pending' ELSE 'done' END,
    attempts=0,last_error=NULL WHERE archive_key=p_key;
  RETURN saved;
END $$;

DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS name
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('sportsdb_save_records','sportsdb_bridge_archive')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',fn.name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.name);
  END LOOP;
END $$;
