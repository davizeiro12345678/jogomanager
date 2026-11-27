\set ON_ERROR_STOP on
-- Disposable local database only. No real matches are simulated or retained.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $privileges$
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.create_match_room_for(uuid,text,text,text)', 'EXECUTE');
  ASSERT NOT has_function_privilege('authenticated', 'public.create_match_room_for(uuid,text,text,text)', 'EXECUTE');
  ASSERT has_function_privilege('service_role', 'public.create_match_room_for(uuid,text,text,text)', 'EXECUTE');
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.create_match_room_for(uuid,text,text,text)'::regprocedure);
END;
$privileges$;
SET LOCAL ROLE service_role;
DO $lifecycle$
DECLARE
  v_host uuid := gen_random_uuid();
  v_old_host uuid := gen_random_uuid();
  v_bulk_host uuid := gen_random_uuid();
  v_result text;
  v_room jsonb;
  v_first_id uuid;
  v_empty_id uuid;
  v_id uuid;
BEGIN
  SELECT result, room INTO v_result, v_room FROM public.create_match_room_for(v_host, 'br_fla', 'ABCDEFGH', gen_random_uuid()::text);
  v_first_id := (v_room ->> 'id')::uuid;
  ASSERT v_result = 'created' AND v_room ->> 'seed' = '' AND (v_room ->> 'server_seeded')::boolean;
  ASSERT EXISTS (SELECT 1 FROM public.match_room_secrets WHERE room_id = v_first_id AND length(seed) >= 16);
  BEGIN
    PERFORM public.create_match_room_for(v_host, 'br_fla', 'ABCDEFGH', gen_random_uuid()::text);
    RAISE EXCEPTION 'duplicate room code unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  ASSERT (SELECT count(*) FROM public.match_rooms WHERE host_id = v_host) = 1;
  PERFORM public.create_match_room_for(v_host, 'br_fla', 'ABCDEFJK', gen_random_uuid()::text);
  PERFORM public.create_match_room_for(v_host, 'br_fla', 'ABCDEFLM', gen_random_uuid()::text);
  SELECT result INTO v_result FROM public.create_match_room_for(v_host, 'br_fla', 'ABCDEFNP', gen_random_uuid()::text);
  ASSERT v_result = 'room_active_limit';
  ASSERT (SELECT count(*) FROM public.match_rooms WHERE host_id = v_host) = 3;
  UPDATE public.match_rooms SET status = 'done' WHERE host_id = v_host;
  FOR i IN 1..17 LOOP
    INSERT INTO public.match_rooms(code, host_id, host_club, seed, status)
      VALUES ('quota-' || v_host::text || '-' || i::text, v_host, 'br_fla', '', 'done');
  END LOOP;
  SELECT result INTO v_result FROM public.create_match_room_for(v_host, 'br_fla', 'ABCDEFPQ', gen_random_uuid()::text);
  ASSERT v_result = 'room_hourly_limit';

  FOR i IN 1..5 LOOP
    INSERT INTO public.match_rooms(code, host_id, host_club, guest_id, seed, server_seeded, status, created_at, updated_at)
    VALUES ('old-' || v_old_host::text || '-' || i::text, v_old_host, 'br_fla', CASE WHEN i = 1 THEN NULL ELSE gen_random_uuid() END,
      '', true, CASE i WHEN 1 THEN 'open' WHEN 2 THEN 'open' WHEN 3 THEN 'ready' WHEN 4 THEN 'live' ELSE 'settling' END,
      clock_timestamp() - interval '2 hours', clock_timestamp() - interval '1 hour') RETURNING id INTO v_id;
    IF i = 1 THEN v_empty_id := v_id; END IF;
    INSERT INTO public.match_room_secrets(room_id, seed) VALUES(v_id, gen_random_uuid()::text);
  END LOOP;
  SELECT result INTO v_result FROM public.create_match_room_for(v_old_host, 'br_fla', 'ABCDEFQR', gen_random_uuid()::text);
  ASSERT v_result = 'room_active_limit';
  ASSERT (SELECT status FROM public.match_rooms WHERE id = v_empty_id) = 'done';
  ASSERT NOT EXISTS (SELECT 1 FROM public.match_room_secrets WHERE room_id = v_empty_id);
  ASSERT (SELECT count(*) FROM public.match_rooms WHERE host_id = v_old_host AND status IN ('open','ready','live','settling')) = 4;
  ASSERT (SELECT count(*) FROM public.match_room_secrets AS s JOIN public.match_rooms AS r ON r.id = s.room_id WHERE r.host_id = v_old_host) = 4;

  FOR i IN 1..30 LOOP
    INSERT INTO public.match_rooms(code, host_id, host_club, seed, server_seeded, status, created_at, updated_at)
    VALUES ('bulk-' || v_bulk_host::text || '-' || i::text, v_bulk_host, 'br_fla', '', true, 'open',
      clock_timestamp() - interval '2 hours', clock_timestamp() - interval '1 hour') RETURNING id INTO v_id;
    INSERT INTO public.match_room_secrets(room_id, seed) VALUES(v_id, gen_random_uuid()::text);
  END LOOP;
  SELECT result INTO v_result FROM public.create_match_room_for(v_bulk_host, 'br_fla', 'ABCDEFST', gen_random_uuid()::text);
  ASSERT v_result = 'room_active_limit';
  ASSERT (SELECT count(*) FROM public.match_rooms WHERE host_id = v_bulk_host AND status = 'done') = 20, 'expiration must touch at most twenty lobbies';
  ASSERT (SELECT count(*) FROM public.match_room_secrets AS s JOIN public.match_rooms AS r ON r.id = s.room_id WHERE r.host_id = v_bulk_host) = 10;
  SELECT result INTO v_result FROM public.create_match_room_for(v_bulk_host, 'br_fla', 'ABCDEFUV', gen_random_uuid()::text);
  ASSERT v_result = 'created', 'bounded cleanup must persist even when a previous creation hit the active quota';
END;
$lifecycle$;
ROLLBACK;
