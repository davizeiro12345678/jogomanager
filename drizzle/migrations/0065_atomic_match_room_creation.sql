-- The host quota, public room and private seed commit atomically.
CREATE INDEX IF NOT EXISTS match_rooms_host_created_idx ON public.match_rooms(host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS match_rooms_host_active_idx ON public.match_rooms(host_id)
  WHERE status IN ('open', 'ready', 'live', 'settling');
CREATE INDEX IF NOT EXISTS match_rooms_host_empty_open_idx ON public.match_rooms(host_id, updated_at, id)
  WHERE status = 'open' AND guest_id IS NULL;

CREATE OR REPLACE FUNCTION public.create_match_room_for(
  p_host_id uuid, p_host_club text, p_code text, p_seed text
)
RETURNS TABLE(result text, room jsonb)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_room public.match_rooms%ROWTYPE;
  v_now timestamptz;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'room creation requires service role' USING ERRCODE = '28000';
  END IF;
  IF p_host_id IS NULL OR p_host_club IS NULL OR p_host_club !~ '^[A-Za-z0-9_:-]{1,80}$'
    OR p_code IS NULL OR p_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'
    OR p_seed IS NULL OR p_seed !~ '^[A-Za-z0-9_-]{16,128}$' THEN
    RAISE EXCEPTION 'invalid room creation request' USING ERRCODE = '23514';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('match-room:' || p_host_id::text, 0));
  -- Capture after lock acquisition so all cutoffs share an indexable current value.
  v_now := pg_catalog.clock_timestamp();
  -- Only abandoned empty lobbies owned by this host expire here. Lock at most
  -- twenty rows; joined, ready, live and settling matches are never expired.
  WITH expired AS (
    SELECT r.id FROM public.match_rooms AS r WHERE r.host_id = p_host_id
      AND r.status = 'open' AND r.guest_id IS NULL
      AND r.updated_at < v_now - interval '30 minutes'
    ORDER BY r.updated_at, r.id LIMIT 20 FOR UPDATE SKIP LOCKED
  ), closed AS (
    UPDATE public.match_rooms AS r SET status = 'done', state = '{}'::jsonb, seed = '',
      updated_at = v_now
    FROM expired WHERE r.id = expired.id RETURNING r.id
  )
  DELETE FROM public.match_room_secrets AS secrets USING closed WHERE secrets.room_id = closed.id;
  IF (SELECT count(*) FROM (SELECT 1 FROM public.match_rooms AS r WHERE r.host_id = p_host_id
      AND r.created_at >= v_now - interval '1 hour' LIMIT 20) AS recent) >= 20 THEN
    RETURN QUERY SELECT 'room_hourly_limit'::text, NULL::jsonb;
    RETURN;
  END IF;
  IF (SELECT count(*) FROM (SELECT 1 FROM public.match_rooms AS r WHERE r.host_id = p_host_id
      AND r.status IN ('open', 'ready', 'live', 'settling') LIMIT 3) AS active) >= 3 THEN
    RETURN QUERY SELECT 'room_active_limit'::text, NULL::jsonb;
    RETURN;
  END IF;
  INSERT INTO public.match_rooms(code, host_id, host_club, seed, server_seeded, status, minute, state)
    VALUES(p_code, p_host_id, p_host_club, '', true, 'open', 0, '{}'::jsonb)
    RETURNING * INTO v_room;
  INSERT INTO public.match_room_secrets(room_id, seed) VALUES(v_room.id, p_seed);
  RETURN QUERY SELECT 'created'::text, pg_catalog.to_jsonb(v_room);
END;
$$;
REVOKE ALL ON FUNCTION public.create_match_room_for(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_match_room_for(uuid, text, text, text) TO service_role;
COMMENT ON FUNCTION public.create_match_room_for(uuid, text, text, text)
  IS 'Server-only atomic room and private seed creation; serialized host quotas: three active rooms and twenty new rooms per hour.';
NOTIFY pgrst, 'reload schema';
