BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE matchmaking_private.cooperative_match_rosters
  ADD COLUMN home_club text,
  ADD COLUMN away_club text,
  ADD CONSTRAINT cooperative_match_clubs CHECK (
    (home_club IS NULL AND away_club IS NULL)
    OR (
      home_club IS NOT NULL AND away_club IS NOT NULL
      AND char_length(home_club) BETWEEN 1 AND 128
      AND char_length(away_club) BETWEEN 1 AND 128
      AND home_club <> away_club
    )
  );

CREATE FUNCTION public.load_live_cooperative_match_fixture(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT pg_catalog.jsonb_build_object(
    'roster', public.load_live_cooperative_match_roster(p_room),
    'homeClub', roster.home_club,
    'awayClub', roster.away_club,
    'seed', roster.seed
  )
  FROM matchmaking_private.cooperative_match_rosters AS roster
  WHERE roster.room_id = p_room
    AND roster.status = 'live'
    AND roster.home_club IS NOT NULL
    AND roster.away_club IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public.load_live_cooperative_match_fixture(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.load_live_cooperative_match_fixture(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
