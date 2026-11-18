BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE matchmaking_private.cooperative_match_rosters (
  room_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_captain uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  home_partner uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  away_captain uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  away_partner uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seed text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '')
    CHECK (seed ~ '^[A-Za-z0-9_-]{16,128}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'closed')),
  CONSTRAINT cooperative_match_four_distinct_users CHECK (
    home_captain NOT IN (home_partner, away_captain, away_partner)
    AND home_partner NOT IN (away_captain, away_partner)
    AND away_captain <> away_partner
  )
);

CREATE INDEX cooperative_match_home_captain_idx ON matchmaking_private.cooperative_match_rosters (home_captain);
CREATE INDEX cooperative_match_home_partner_idx ON matchmaking_private.cooperative_match_rosters (home_partner);
CREATE INDEX cooperative_match_away_captain_idx ON matchmaking_private.cooperative_match_rosters (away_captain);
CREATE INDEX cooperative_match_away_partner_idx ON matchmaking_private.cooperative_match_rosters (away_partner);

ALTER TABLE matchmaking_private.cooperative_match_rosters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON matchmaking_private.cooperative_match_rosters FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA matchmaking_private TO service_role;
GRANT SELECT, INSERT ON matchmaking_private.cooperative_match_rosters TO service_role;
GRANT UPDATE(status) ON matchmaking_private.cooperative_match_rosters TO service_role;

CREATE FUNCTION matchmaking_private.guard_cooperative_roster_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (
    OLD.status = 'closed' OR (OLD.status = 'live' AND NEW.status = 'pending')
  ) THEN
    RAISE EXCEPTION 'cooperative roster status cannot move backward' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION matchmaking_private.guard_cooperative_roster_status() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cooperative_roster_status_guard
  BEFORE UPDATE OF status ON matchmaking_private.cooperative_match_rosters
  FOR EACH ROW EXECUTE FUNCTION matchmaking_private.guard_cooperative_roster_status();

CREATE FUNCTION public.load_live_cooperative_match_roster(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT pg_catalog.jsonb_build_object(
    'version', 2,
    'roomId', roster.room_id,
    'status', roster.status,
    'settlementAuthority', 'websocket',
    'serverSeeded', true,
    'seats', pg_catalog.jsonb_build_object(
      'home_captain', roster.home_captain,
      'home_partner', roster.home_partner,
      'away_captain', roster.away_captain,
      'away_partner', roster.away_partner
    )
  )
  FROM matchmaking_private.cooperative_match_rosters AS roster
  WHERE roster.room_id = p_room AND roster.status = 'live';
$function$;

REVOKE ALL ON FUNCTION public.load_live_cooperative_match_roster(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.load_live_cooperative_match_roster(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
