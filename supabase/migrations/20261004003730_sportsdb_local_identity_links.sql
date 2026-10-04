-- Resolve SportsDB numeric IDs against the game's namespaced x/y IDs and
-- preserve only exact, unambiguous club links.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

SELECT 1 FROM public.sportsdb_bridge_control WHERE singleton=true FOR UPDATE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.sportsdb_bridge_control
    WHERE lease_owner IS NOT NULL AND lease_until > now()
  ) THEN
    RAISE EXCEPTION 'Wait for the active SportsDB bridge lease before applying identity link repair';
  END IF;
END $$;

DROP INDEX IF EXISTS public.players_source_source_id_uidx;

DROP POLICY IF EXISTS "SportsDB identity aliases service only" ON public.sportsdb_competition_identity_aliases;
CREATE POLICY "SportsDB identity aliases service only"
  ON public.sportsdb_competition_identity_aliases FOR ALL TO service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "SportsDB identity aliases service only" ON public.sportsdb_club_identity_aliases;
CREATE POLICY "SportsDB identity aliases service only"
  ON public.sportsdb_club_identity_aliases FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.sportsdb_resolve_local_competition(
  p_source_id text,p_name text,p_country text
) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE candidate text;
DECLARE candidates integer;
BEGIN
  WITH matches AS (
    SELECT coalesce(a.canonical_id,c.id) AS id
    FROM public.competitions c
    LEFT JOIN public.sportsdb_competition_identity_aliases a ON a.alias_id=c.id
    WHERE c.source_id IN ('x'||p_source_id,'y'||p_source_id)
    UNION
    SELECT coalesce(a.canonical_id,c.id) AS id
    FROM public.competitions c
    LEFT JOIN public.sportsdb_competition_identity_aliases a ON a.alias_id=c.id
    WHERE lower(regexp_replace(btrim(c.name),'[[:space:]]+',' ','g'))=
          lower(regexp_replace(btrim(coalesce(p_name,'')),'[[:space:]]+',' ','g'))
      AND lower(regexp_replace(btrim(coalesce(c.country,'')),'[[:space:]]+',' ','g'))=
          lower(regexp_replace(btrim(coalesce(p_country,'')),'[[:space:]]+',' ','g'))
  )
  SELECT min(id),count(*) INTO candidate,candidates FROM matches;
  IF candidates=1 THEN RETURN candidate; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.sportsdb_resolve_local_club(
  p_competition_id text,p_name text
) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE candidate text;
DECLARE candidates integer;
BEGIN
  SELECT min(c.id),count(*) INTO candidate,candidates
  FROM public.clubs c
  WHERE c.competition_id=p_competition_id
    AND lower(regexp_replace(btrim(c.name),'[[:space:]]+',' ','g'))=
        lower(regexp_replace(btrim(coalesce(p_name,'')),'[[:space:]]+',' ','g'));
  IF candidates=1 THEN RETURN candidate; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.sportsdb_link_local_competition()
RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.local_competition_id IS NULL AND NEW.sport='Soccer' THEN
    NEW.local_competition_id := public.sportsdb_resolve_local_competition(NEW.source_id,NEW.name,NEW.country);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sportsdb_local_competition_link ON public.official_leagues;
CREATE TRIGGER sportsdb_local_competition_link
  BEFORE INSERT OR UPDATE OF source_id,name,country,sport,local_competition_id
  ON public.official_leagues FOR EACH ROW
  EXECUTE FUNCTION public.sportsdb_link_local_competition();

CREATE OR REPLACE FUNCTION public.sportsdb_link_local_club()
RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE local_competition text;
BEGIN
  IF NEW.local_club_id IS NOT NULL OR NEW.sport<>'Soccer' OR NEW.league_source_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT l.local_competition_id INTO local_competition
  FROM public.official_leagues l
  WHERE l.source_id=NEW.league_source_id AND l.sport='Soccer';
  IF local_competition IS NOT NULL THEN
    NEW.local_club_id := public.sportsdb_resolve_local_club(local_competition,NEW.name);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sportsdb_local_club_link ON public.official_teams;
CREATE TRIGGER sportsdb_local_club_link
  BEFORE INSERT OR UPDATE OF league_source_id,name,sport,local_club_id
  ON public.official_teams FOR EACH ROW
  EXECUTE FUNCTION public.sportsdb_link_local_club();

WITH league_candidates AS (
  SELECT l.source_id,coalesce(a.canonical_id,c.id) AS competition_id
  FROM public.official_leagues l
  JOIN public.competitions c ON c.source_id IN ('x'||l.source_id,'y'||l.source_id)
  LEFT JOIN public.sportsdb_competition_identity_aliases a ON a.alias_id=c.id
  WHERE l.sport='Soccer'
  UNION
  SELECT l.source_id,coalesce(a.canonical_id,c.id)
  FROM public.official_leagues l
  JOIN public.competitions c
    ON lower(regexp_replace(btrim(c.name),'[[:space:]]+',' ','g'))=
       lower(regexp_replace(btrim(l.name),'[[:space:]]+',' ','g'))
   AND lower(regexp_replace(btrim(c.country),'[[:space:]]+',' ','g'))=
       lower(regexp_replace(btrim(coalesce(l.country,'')),'[[:space:]]+',' ','g'))
  LEFT JOIN public.sportsdb_competition_identity_aliases a ON a.alias_id=c.id
  WHERE l.sport='Soccer'
), unique_leagues AS (
  SELECT source_id,min(competition_id) AS competition_id
  FROM league_candidates GROUP BY source_id
  HAVING count(DISTINCT competition_id)=1
)
INSERT INTO public.sportsdb_data_corrections(correction_key,table_name,source_id,reason,before_row)
SELECT 'local-competition-link-v1','official_leagues',l.source_id,
  'Original source ID uses a numeric value while local competition IDs are namespaced; exact mapping is retained here',to_jsonb(l)
FROM public.official_leagues l
JOIN unique_leagues m ON m.source_id=l.source_id
WHERE l.local_competition_id IS DISTINCT FROM m.competition_id
ON CONFLICT (correction_key,table_name,source_id) DO NOTHING;

WITH league_candidates AS (
  SELECT l.source_id,coalesce(a.canonical_id,c.id) AS competition_id
  FROM public.official_leagues l
  JOIN public.competitions c ON c.source_id IN ('x'||l.source_id,'y'||l.source_id)
  LEFT JOIN public.sportsdb_competition_identity_aliases a ON a.alias_id=c.id
  WHERE l.sport='Soccer'
  UNION
  SELECT l.source_id,coalesce(a.canonical_id,c.id)
  FROM public.official_leagues l
  JOIN public.competitions c
    ON lower(regexp_replace(btrim(c.name),'[[:space:]]+',' ','g'))=
       lower(regexp_replace(btrim(l.name),'[[:space:]]+',' ','g'))
   AND lower(regexp_replace(btrim(c.country),'[[:space:]]+',' ','g'))=
       lower(regexp_replace(btrim(coalesce(l.country,'')),'[[:space:]]+',' ','g'))
  LEFT JOIN public.sportsdb_competition_identity_aliases a ON a.alias_id=c.id
  WHERE l.sport='Soccer'
), unique_leagues AS (
  SELECT source_id,min(competition_id) AS competition_id
  FROM league_candidates GROUP BY source_id
  HAVING count(DISTINCT competition_id)=1
)
UPDATE public.official_leagues l
SET local_competition_id=m.competition_id,updated_at=now()
FROM unique_leagues m
WHERE l.source_id=m.source_id AND l.local_competition_id IS DISTINCT FROM m.competition_id;

WITH team_matches AS (
  SELECT t.source_id,c.id AS club_id,
    count(*) OVER (PARTITION BY t.source_id) AS candidate_count
  FROM public.official_teams t
  JOIN public.official_leagues l ON l.source_id=t.league_source_id AND l.sport='Soccer'
  JOIN public.clubs c ON c.competition_id=l.local_competition_id
   AND lower(regexp_replace(btrim(c.name),'[[:space:]]+',' ','g'))=
       lower(regexp_replace(btrim(t.name),'[[:space:]]+',' ','g'))
  WHERE t.sport='Soccer' AND t.local_club_id IS NULL AND l.local_competition_id IS NOT NULL
), unique_teams AS (
  SELECT source_id,min(club_id) AS club_id
  FROM team_matches WHERE candidate_count=1 GROUP BY source_id
)
INSERT INTO public.sportsdb_data_corrections(correction_key,table_name,source_id,reason,before_row)
SELECT 'local-club-link-v1','official_teams',t.source_id,
  'Source team name uniquely matches one club inside the mapped local competition',to_jsonb(t)
FROM public.official_teams t JOIN unique_teams m ON m.source_id=t.source_id
ON CONFLICT (correction_key,table_name,source_id) DO NOTHING;

WITH team_matches AS (
  SELECT t.source_id,c.id AS club_id,
    count(*) OVER (PARTITION BY t.source_id) AS candidate_count
  FROM public.official_teams t
  JOIN public.official_leagues l ON l.source_id=t.league_source_id AND l.sport='Soccer'
  JOIN public.clubs c ON c.competition_id=l.local_competition_id
   AND lower(regexp_replace(btrim(c.name),'[[:space:]]+',' ','g'))=
       lower(regexp_replace(btrim(t.name),'[[:space:]]+',' ','g'))
  WHERE t.sport='Soccer' AND t.local_club_id IS NULL AND l.local_competition_id IS NOT NULL
), unique_teams AS (
  SELECT source_id,min(club_id) AS club_id
  FROM team_matches WHERE candidate_count=1 GROUP BY source_id
)
UPDATE public.official_teams t
SET local_club_id=m.club_id,updated_at=now()
FROM unique_teams m
WHERE t.source_id=m.source_id AND t.local_club_id IS NULL;

WITH unique_club_ids AS (
  SELECT local_club_id,min(source_id) AS source_id
  FROM public.official_teams
  WHERE local_club_id IS NOT NULL AND sport='Soccer'
  GROUP BY local_club_id
  HAVING count(DISTINCT source_id)=1
), safe_ids AS (
  SELECT u.local_club_id,u.source_id
  FROM unique_club_ids u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.club_external_ids x
    WHERE x.source='thesportsdb' AND x.external_id=u.source_id AND x.club_id<>u.local_club_id
  )
)
INSERT INTO public.club_external_ids(club_id,source,external_id,confirmed)
SELECT local_club_id,'thesportsdb',source_id,true FROM safe_ids
ON CONFLICT DO NOTHING;

DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS name
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'sportsdb_resolve_local_competition','sportsdb_resolve_local_club',
      'sportsdb_link_local_competition','sportsdb_link_local_club'
    )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',fn.name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.name);
  END LOOP;
END $$;
