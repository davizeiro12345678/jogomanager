-- Match allocation MUST be one PostgreSQL transaction. A background worker
-- calling claim -> create room -> confirm in three RPCs can lose a seat, leave
-- orphan rooms or create a match after the lease has expired.
-- Opt-in only: this does not activate matchmaking or expose public grants.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.match_queue_allocate()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_claim jsonb;
  v_pair uuid;
  v_home uuid;
  v_away uuid;
  v_home_club text;
  v_away_club text;
  v_mode text;
  v_code text;
  v_seed text;
  v_room uuid;
  v_now timestamptz;
  v_attempt integer;
BEGIN
  -- Same advisory lock as claim, confirm and release: a second worker cannot
  -- claim this pair or bind it to another room in parallel.
  PERFORM pg_catalog.pg_advisory_xact_lock(772913552);
  v_claim := public.match_queue_claim();
  IF v_claim IS NULL THEN RETURN NULL; END IF;

  v_pair := (v_claim->>'pairId')::uuid;
  v_home := (v_claim->>'homeId')::uuid;
  v_away := (v_claim->>'awayId')::uuid;
  v_home_club := v_claim->>'homeClub';
  v_away_club := v_claim->>'awayClub';
  v_mode := v_claim->>'mode';
  IF v_pair IS NULL OR v_home IS NULL OR v_away IS NULL OR v_home = v_away
    OR v_mode NOT IN ('casual','ranked')
    OR v_home_club IS NULL OR v_away_club IS NULL
    OR v_home_club !~ '^[A-Za-z0-9_:-]{1,80}$'
    OR v_away_club !~ '^[A-Za-z0-9_:-]{1,80}$'
  THEN RAISE EXCEPTION 'invalid_queue_pair_contract'; END IF;

  -- Follow existing match-room host quotas and lock order. Do not bypass
  -- one-hour creation limits by running automatic queue allocation.
  -- A live database room is not an actively ticking match: the match session
  -- still requires both signed seats to send READY before its first step.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('match-room:' || v_home::text, 0)
  );
  v_now := pg_catalog.clock_timestamp();
  IF (
    SELECT count(*) FROM (
      SELECT 1 FROM public.match_rooms
      WHERE host_id=v_home AND created_at >= v_now - interval '1 hour'
      LIMIT 20
    ) recent
  ) >= 20 OR (
    SELECT count(*) FROM (
      SELECT 1 FROM public.match_rooms
      WHERE host_id=v_home AND status IN ('open','ready','live','settling')
      LIMIT 3
    ) active
  ) >= 3 THEN
    PERFORM public.match_queue_release(v_pair);
    RETURN jsonb_build_object('status','host_capacity');
  END IF;

  -- The room code is a public locator, not an authentication credential.
  -- A fresh server-side UUID supplies both private randomness and public code
  -- entropy; a collision is retried while retaining our transaction lock.
  v_seed := replace(pg_catalog.gen_random_uuid()::text,'-','');
  FOR v_attempt IN 1..3 LOOP
    v_code := pg_catalog.translate(
      pg_catalog.substr(pg_catalog.md5(pg_catalog.gen_random_uuid()::text), 1, 8),
      '0123456789abcdef','23456789ABCDEFGH'
    );
    BEGIN
      INSERT INTO public.match_rooms(
        code,host_id,guest_id,host_club,guest_club,seed,
        server_seeded,status,minute,state
      ) VALUES (
        v_code,v_home,v_away,v_home_club,v_away_club,'',
        true,'live',0,'{}'::jsonb
      ) RETURNING id INTO v_room;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 3 THEN RAISE; END IF;
    END;
  END LOOP;
  IF v_room IS NULL THEN RAISE EXCEPTION 'room_allocation_failed'; END IF;

  INSERT INTO public.match_room_secrets(room_id,seed) VALUES (v_room,v_seed);
  IF NOT public.match_queue_confirm(v_pair,v_room) THEN
    RAISE EXCEPTION 'pair_confirmation_failed';
  END IF;
  RETURN jsonb_build_object(
    'status','allocated','roomId',v_room,'pairId',v_pair,'mode',v_mode,
    'homeId',v_home,'awayId',v_away
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_queue_status(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $function$
DECLARE
  v_room record;
  v_queue record;
BEGIN
  IF p_user IS NULL THEN RETURN jsonb_build_object('status','not_joined'); END IF;
  -- Only returned to the already authenticated user via a service-role RPC.
  -- No opponent rating or private room seed is included in this response.
  SELECT room.id, room.status AS room_status, pair.mode
    INTO v_room
    FROM matchmaking_private.pairs pair
    JOIN public.match_rooms room ON room.id=pair.room_id
    WHERE pair.status='committed'
      AND pair.created_at >= pg_catalog.now() - interval '15 minutes'
      AND (pair.home_id=p_user OR pair.away_id=p_user)
      AND room.status IN ('ready','live','settling')
    ORDER BY pair.created_at DESC
    LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status','matched','roomId',v_room.id,
      'roomStatus',v_room.room_status,'mode',v_room.mode
    );
  END IF;

  SELECT mode,region,expires_at,status INTO v_queue
    FROM matchmaking_private.queue
    WHERE user_id=p_user AND expires_at>pg_catalog.clock_timestamp()
    LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status',v_queue.status,
      'mode',v_queue.mode,
      'region',v_queue.region
    );
  END IF;
  RETURN jsonb_build_object('status','not_joined');
END;
$function$;

REVOKE ALL ON FUNCTION public.match_queue_allocate() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.match_queue_status(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.match_queue_allocate() TO service_role;
GRANT EXECUTE ON FUNCTION public.match_queue_status(uuid) TO service_role;
COMMENT ON FUNCTION public.match_queue_allocate() IS
 'Atomic queue claim, host quota, private seed, live room and pair commit. Run only from a bounded service worker.';
COMMIT;
