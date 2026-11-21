\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users(id, email, email_confirmed_at)
VALUES
  ('83000000-0000-4000-8000-000000000001', 'coop-home-captain@example.test', now()),
  ('83000000-0000-4000-8000-000000000002', 'coop-home-partner@example.test', now()),
  ('83000000-0000-4000-8000-000000000003', 'coop-away-captain@example.test', now()),
  ('83000000-0000-4000-8000-000000000004', 'coop-away-partner@example.test', now());

DO $access$
BEGIN
  IF has_table_privilege('anon', 'matchmaking_private.cooperative_match_rosters', 'SELECT,INSERT,UPDATE')
    OR has_table_privilege('authenticated', 'matchmaking_private.cooperative_match_rosters', 'SELECT,INSERT,UPDATE')
    OR has_function_privilege('anon', 'public.load_live_cooperative_match_roster(uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.load_live_cooperative_match_roster(uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.load_live_cooperative_match_fixture(uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.load_live_cooperative_match_fixture(uuid)', 'EXECUTE')
    OR has_column_privilege('service_role', 'matchmaking_private.cooperative_match_rosters', 'home_captain', 'UPDATE')
  THEN RAISE EXCEPTION 'cooperative roster grants exceed their intended scope'; END IF;
END;
$access$;

SET LOCAL ROLE service_role;
DO $contract$
DECLARE
  v_home_captain uuid := '83000000-0000-4000-8000-000000000001';
  v_home_partner uuid := '83000000-0000-4000-8000-000000000002';
  v_away_captain uuid := '83000000-0000-4000-8000-000000000003';
  v_away_partner uuid := '83000000-0000-4000-8000-000000000004';
  v_room uuid;
  v_roster jsonb;
BEGIN
  BEGIN
    INSERT INTO matchmaking_private.cooperative_match_rosters
      (home_captain, home_partner, away_captain, away_partner)
    VALUES (v_home_captain, v_home_partner, v_away_captain, v_home_captain);
    RAISE EXCEPTION 'duplicate cooperative participant accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  INSERT INTO matchmaking_private.cooperative_match_rosters
    (home_captain, home_partner, away_captain, away_partner)
  VALUES (v_home_captain, v_home_partner, v_away_captain, v_away_partner)
  RETURNING room_id INTO v_room;
  IF public.load_live_cooperative_match_roster(v_room) IS NOT NULL THEN
    RAISE EXCEPTION 'pending roster returned as live';
  END IF;

  UPDATE matchmaking_private.cooperative_match_rosters SET status = 'live' WHERE room_id = v_room;
  v_roster := public.load_live_cooperative_match_roster(v_room);
  IF v_roster IS DISTINCT FROM jsonb_build_object(
    'version', 2, 'roomId', v_room, 'status', 'live',
    'settlementAuthority', 'websocket', 'serverSeeded', true,
    'seats', jsonb_build_object(
      'home_captain', v_home_captain, 'home_partner', v_home_partner,
      'away_captain', v_away_captain, 'away_partner', v_away_partner
    )
  ) THEN RAISE EXCEPTION 'unexpected live roster payload'; END IF;

  UPDATE matchmaking_private.cooperative_match_rosters SET status = 'closed' WHERE room_id = v_room;
  IF public.load_live_cooperative_match_roster(v_room) IS NOT NULL THEN
    RAISE EXCEPTION 'closed roster returned as live';
  END IF;
  BEGIN
    UPDATE matchmaking_private.cooperative_match_rosters SET status = 'live' WHERE room_id = v_room;
    RAISE EXCEPTION 'closed cooperative roster reopened';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  INSERT INTO matchmaking_private.cooperative_match_rosters
    (home_captain, home_partner, away_captain, away_partner, home_club, away_club)
  VALUES (v_home_captain, v_home_partner, v_away_captain, v_away_partner, 'fla', 'pal')
  RETURNING room_id INTO v_room;
  IF public.load_live_cooperative_match_fixture(v_room) IS NOT NULL THEN
    RAISE EXCEPTION 'pending fixture returned as live';
  END IF;
  UPDATE matchmaking_private.cooperative_match_rosters SET status = 'live' WHERE room_id = v_room;
  v_roster := public.load_live_cooperative_match_fixture(v_room);
  IF v_roster IS NULL OR v_roster ->> 'homeClub' IS DISTINCT FROM 'fla'
    OR v_roster ->> 'awayClub' IS DISTINCT FROM 'pal' OR length(v_roster ->> 'seed') < 16
    OR v_roster -> 'roster' IS DISTINCT FROM public.load_live_cooperative_match_roster(v_room)
  THEN RAISE EXCEPTION 'unexpected private fixture payload'; END IF;
END;
$contract$;
RESET ROLE;
ROLLBACK;
