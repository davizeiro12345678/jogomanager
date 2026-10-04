-- Keep verified local identity links when an upsert omits the optional link
-- columns, but recalculate if the source entity actually changes identity.
CREATE OR REPLACE FUNCTION public.sportsdb_link_local_competition()
RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP='UPDATE'
     AND NEW.sport IS NOT DISTINCT FROM OLD.sport
     AND NEW.source_id IS NOT DISTINCT FROM OLD.source_id
     AND NEW.name IS NOT DISTINCT FROM OLD.name
     AND NEW.country IS NOT DISTINCT FROM OLD.country
     AND NEW.local_competition_id IS NULL THEN
    NEW.local_competition_id := OLD.local_competition_id;
  ELSIF NEW.sport='Soccer' THEN
    NEW.local_competition_id := public.sportsdb_resolve_local_competition(
      NEW.source_id,NEW.name,NEW.country
    );
  ELSE
    NEW.local_competition_id := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sportsdb_link_local_club()
RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE local_competition text;
BEGIN
  IF TG_OP='UPDATE'
     AND NEW.sport IS NOT DISTINCT FROM OLD.sport
     AND NEW.league_source_id IS NOT DISTINCT FROM OLD.league_source_id
     AND NEW.name IS NOT DISTINCT FROM OLD.name
     AND NEW.local_club_id IS NULL THEN
    NEW.local_club_id := OLD.local_club_id;
  ELSIF NEW.sport='Soccer' AND NEW.league_source_id IS NOT NULL THEN
    SELECT l.local_competition_id INTO local_competition
    FROM public.official_leagues l
    WHERE l.source_id=NEW.league_source_id AND l.sport='Soccer';
    NEW.local_club_id := CASE WHEN local_competition IS NULL THEN NULL
      ELSE public.sportsdb_resolve_local_club(local_competition,NEW.name) END;
  ELSE
    NEW.local_club_id := NULL;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.sportsdb_link_local_competition() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sportsdb_link_local_club() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sportsdb_link_local_competition() TO service_role;
GRANT EXECUTE ON FUNCTION public.sportsdb_link_local_club() TO service_role;
