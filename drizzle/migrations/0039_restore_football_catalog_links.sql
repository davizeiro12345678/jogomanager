-- Structural restore for the football catalog code paths. Reconciliation backfills
-- from the other backend's history are intentionally not replayed on live data.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'player';
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_source_kind_check;
ALTER TABLE public.players ADD CONSTRAINT players_source_kind_check CHECK (source_kind IN ('player','staff'));
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS canonical_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS players_canonical_alias_idx ON public.players(canonical_player_id) WHERE canonical_player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS players_club_playable_idx ON public.players(club_id, name) WHERE source_kind = 'player' AND canonical_player_id IS NULL;

ALTER TABLE public.official_teams ADD COLUMN IF NOT EXISTS sport text NOT NULL DEFAULT 'Unknown';
UPDATE public.official_teams SET sport = 'Soccer' WHERE source_id LIKE 'af:%' AND sport = 'Unknown';

CREATE TABLE IF NOT EXISTS public.official_venues (
  source_id text PRIMARY KEY,
  name text NOT NULL,
  city text,
  country text,
  capacity integer,
  photo_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.official_venues TO anon, authenticated;
GRANT ALL ON public.official_venues TO service_role;
ALTER TABLE public.official_venues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Official venues are public" ON public.official_venues;
CREATE POLICY "Official venues are public" ON public.official_venues FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.club_catalog_links (
  source_club_id text PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
  club_id text NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('api-football','thesportsdb')),
  source_team_id text REFERENCES public.official_teams(source_id) ON DELETE SET NULL,
  match_rule text NOT NULL DEFAULT 'unique-normalized-name-country',
  metadata_before jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (club_id <> source_club_id)
);
CREATE INDEX IF NOT EXISTS club_catalog_links_club_idx ON public.club_catalog_links(club_id);
CREATE UNIQUE INDEX IF NOT EXISTS club_catalog_links_team_idx ON public.club_catalog_links(source_team_id) WHERE source_team_id IS NOT NULL;
REVOKE ALL ON public.club_catalog_links FROM anon, authenticated;
GRANT SELECT ON public.club_catalog_links TO anon, authenticated;
GRANT ALL ON public.club_catalog_links TO service_role;
ALTER TABLE public.club_catalog_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Club identity links are public" ON public.club_catalog_links;
CREATE POLICY "Club identity links are public" ON public.club_catalog_links FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.player_identity_aliases (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  canonical_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  source text,
  source_id text,
  match_rule text NOT NULL DEFAULT 'verified-birth-club-and-name',
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (player_id <> canonical_player_id)
);
CREATE INDEX IF NOT EXISTS player_identity_aliases_canonical_idx ON public.player_identity_aliases(canonical_player_id);
REVOKE ALL ON public.player_identity_aliases FROM anon, authenticated;
GRANT SELECT ON public.player_identity_aliases TO anon, authenticated;
GRANT ALL ON public.player_identity_aliases TO service_role;
ALTER TABLE public.player_identity_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read public athlete identity aliases" ON public.player_identity_aliases;
CREATE POLICY "Read public athlete identity aliases" ON public.player_identity_aliases FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.enrich_football_venues(p_venues jsonb)
RETURNS integer LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE changed integer;
BEGIN
  IF p_venues IS NULL OR jsonb_typeof(p_venues) <> 'array' OR jsonb_array_length(p_venues) > 250 THEN
    RAISE EXCEPTION 'Venue batch must contain at most 250 records' USING ERRCODE = '22023';
  END IF;
  WITH supplied AS MATERIALIZED (
    SELECT DISTINCT ON (id) 'af:' || id AS source_id, left(name, 160) AS name,
      CASE WHEN length(city) BETWEEN 1 AND 160 THEN city END AS city,
      CASE WHEN length(country) BETWEEN 1 AND 120 THEN country END AS country,
      CASE WHEN capacity ~ '^[0-9]{1,6}$' THEN CASE WHEN capacity::integer BETWEEN 1 AND 500000 THEN capacity::integer END END AS capacity,
      CASE WHEN image LIKE 'https://%' AND length(image) <= 2048 THEN image END AS photo_url
    FROM jsonb_to_recordset(p_venues) AS x(id text, team_id text, name text, city text, country text, capacity text, image text)
    WHERE id ~ '^[1-9][0-9]{0,11}$' AND length(trim(name)) BETWEEN 1 AND 160
    ORDER BY id
  )
  INSERT INTO public.official_venues AS cur (source_id, name, city, country, capacity, photo_url, updated_at)
  SELECT source_id, name, city, country, capacity, photo_url, now() FROM supplied
  ON CONFLICT (source_id) DO UPDATE SET
    city = coalesce(cur.city, excluded.city), country = coalesce(cur.country, excluded.country),
    capacity = coalesce(cur.capacity, excluded.capacity), photo_url = coalesce(cur.photo_url, excluded.photo_url),
    updated_at = now()
  WHERE (cur.city IS NULL AND excluded.city IS NOT NULL) OR (cur.country IS NULL AND excluded.country IS NOT NULL)
    OR (cur.capacity IS NULL AND excluded.capacity IS NOT NULL) OR (cur.photo_url IS NULL AND excluded.photo_url IS NOT NULL);
  GET DIAGNOSTICS changed = ROW_COUNT;
  WITH mappings AS (
    SELECT DISTINCT ON (team_id) 'af:' || team_id AS team_id, 'af:' || id AS venue_id
    FROM jsonb_to_recordset(p_venues) AS x(id text, team_id text)
    WHERE id ~ '^[1-9][0-9]{0,11}$' AND team_id ~ '^[1-9][0-9]{0,11}$'
    ORDER BY team_id
  )
  UPDATE public.official_teams t SET venue_source_id = m.venue_id FROM mappings m
  WHERE t.source_id = m.team_id AND t.venue_source_id IS NULL
    AND EXISTS (SELECT 1 FROM public.official_venues v WHERE v.source_id = m.venue_id);
  RETURN changed;
END $function$;
REVOKE ALL ON FUNCTION public.enrich_football_venues(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enrich_football_venues(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.enrich_existing_football_profiles(p_profiles jsonb)
RETURNS integer LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE changed integer;
BEGIN
  IF p_profiles IS NULL OR jsonb_typeof(p_profiles) <> 'array' OR jsonb_array_length(p_profiles) > 250 THEN
    RAISE EXCEPTION 'Profile batch must be an array of at most 250 records' USING ERRCODE = '22023';
  END IF;
  WITH supplied AS (
    SELECT source_id,
      CASE WHEN birth_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND pg_input_is_valid(birth_date, 'date')
        THEN CASE WHEN birth_date::date >= '1880-01-01'::date AND birth_date::date < current_date THEN birth_date::date END END AS birth_date,
      CASE WHEN photo_url LIKE 'https://%' AND length(photo_url) <= 2048 THEN photo_url END AS photo_url,
      CASE WHEN length(nationality) BETWEEN 1 AND 100 THEN nationality END AS nationality
    FROM jsonb_to_recordset(p_profiles) AS x(source_id text, birth_date text, photo_url text, nationality text)
  )
  UPDATE public.players p SET birth_date = coalesce(p.birth_date, s.birth_date),
    photo_url = coalesce(p.photo_url, s.photo_url), nationality = coalesce(p.nationality, s.nationality)
  FROM supplied s
  WHERE p.source = 'api-football' AND p.source_kind = 'player' AND p.source_id = s.source_id
    AND ((p.birth_date IS NULL AND s.birth_date IS NOT NULL) OR (p.photo_url IS NULL AND s.photo_url IS NOT NULL)
      OR (p.nationality IS NULL AND s.nationality IS NOT NULL));
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END $function$;
REVOKE ALL ON FUNCTION public.enrich_existing_football_profiles(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enrich_existing_football_profiles(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_league_digest_source(p_league_ids integer[])
RETURNS TABLE (league_id integer, payload jsonb, injury_count bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' ROWS 32
AS $function$
BEGIN
  IF p_league_ids IS NULL
     OR array_ndims(p_league_ids) IS DISTINCT FROM 1
     OR cardinality(p_league_ids) NOT BETWEEN 1 AND 32
     OR EXISTS (SELECT 1 FROM unnest(p_league_ids) AS ids(id) WHERE ids.id IS NULL OR ids.id <= 0) THEN
    RAISE EXCEPTION 'Expected between 1 and 32 positive league IDs' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH requested AS MATERIALIZED (
    SELECT u.id, min(u.ordinality) AS ord
    FROM unnest(p_league_ids) WITH ORDINALITY AS u(id, ordinality)
    GROUP BY u.id
  ), latest_standings AS (
    SELECT DISTINCT ON (r.id) r.id, a.payload
    FROM requested r
    JOIN public.api_football_data a
      ON a.kind = 'standings' AND split_part(a.ref, ':', 1) = r.id::text AND a.ref LIKE r.id::text || ':%'
    ORDER BY r.id, a.ref DESC
  )
  SELECT r.id AS league_id, standings.payload, injuries.injury_count
  FROM requested r
  LEFT JOIN latest_standings standings ON standings.id = r.id
  CROSS JOIN LATERAL (
    SELECT count(*) AS injury_count FROM public.api_football_data a
    WHERE a.kind = 'injury' AND a.payload->'league'->>'id' = r.id::text
  ) injuries
  ORDER BY r.ord;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_public_league_digest_source(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_league_digest_source(integer[]) TO service_role;

NOTIFY pgrst, 'reload schema';