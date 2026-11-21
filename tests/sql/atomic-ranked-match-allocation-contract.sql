-- Disposable Supabase Postgres only; migration 0075 must be applied.
-- No external service call, no production records, no committed fixtures.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('50000000-0000-4000-8000-000000000001','allocate-home@example.test',now()),
 ('50000000-0000-4000-8000-000000000002','allocate-away@example.test',now()),
 ('50000000-0000-4000-8000-000000000003','allocate-none@example.test',now());

DO $contract$
DECLARE
  v_first jsonb;
  v_room uuid;
  v_pair uuid;
  v_seed text;
  v_code text;
  v_public_seed text;
  v_status jsonb;
BEGIN
  IF public.match_queue_allocate() IS NOT NULL THEN
    RAISE EXCEPTION 'allocated room without any waiting players';
  END IF;
  PERFORM public.match_queue_join('50000000-0000-4000-8000-000000000001','ARS','ranked','sa');
  PERFORM public.match_queue_join('50000000-0000-4000-8000-000000000002','CHE','ranked','sa');
  v_first := public.match_queue_allocate();
  IF v_first->>'status'<>'allocated' OR v_first->>'mode'<>'ranked'
  THEN RAISE EXCEPTION 'allocation did not bind ranked pair: %', v_first; END IF;
  v_room := (v_first->>'roomId')::uuid;
  v_pair := (v_first->>'pairId')::uuid;
  SELECT seed INTO v_seed FROM public.match_room_secrets WHERE room_id=v_room;
  SELECT code,seed INTO v_code,v_public_seed FROM public.match_rooms WHERE id=v_room
    AND host_id='50000000-0000-4000-8000-000000000001'
    AND guest_id='50000000-0000-4000-8000-000000000002'
    AND host_club='ARS' AND guest_club='CHE'
    AND status='live' AND server_seeded=true;
  IF v_code IS NULL OR length(v_code)<>8 OR v_public_seed<>'' OR
    v_seed IS NULL OR length(v_seed)<16 OR v_seed=v_code
  THEN RAISE EXCEPTION 'private room seed leaked or live room invalid'; END IF;
  IF (SELECT count(*) FROM matchmaking_private.queue
      WHERE user_id IN (
        '50000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000002'))<>0
  THEN RAISE EXCEPTION 'committed pair was not dequeued'; END IF;
  IF (SELECT count(*) FROM matchmaking_private.pairs
      WHERE id=v_pair AND room_id=v_room AND status='committed')<>1
  THEN RAISE EXCEPTION 'match pair was not bound to room'; END IF;
  v_status := public.match_queue_status('50000000-0000-4000-8000-000000000001');
  IF v_status->>'status'<>'matched' OR (v_status->>'roomId')::uuid<>v_room OR
      v_status ? 'seed' THEN
    RAISE EXCEPTION 'match status did not find current private room'; END IF;
  IF (public.match_queue_status('50000000-0000-4000-8000-000000000003')->>'status')<>'not_joined'
  THEN RAISE EXCEPTION 'unrelated player discovered matched room'; END IF;
  IF public.match_queue_allocate() IS NOT NULL THEN
    RAISE EXCEPTION 'a second allocation reused committed seats'; END IF;

  -- Do not reveal a finished room via stale-pair polling.
  UPDATE public.match_rooms SET status='done' WHERE id=v_room;
  IF (public.match_queue_status('50000000-0000-4000-8000-000000000001')->>'status')<>'not_joined'
  THEN RAISE EXCEPTION 'finished room was returned as a live match'; END IF;
END;
$contract$;

DO $acl$
BEGIN
  IF has_function_privilege('anon','public.match_queue_allocate()','EXECUTE')
    OR has_function_privilege('authenticated','public.match_queue_allocate()','EXECUTE')
    OR has_function_privilege('anon','public.match_queue_status(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.match_queue_status(uuid)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.match_queue_allocate()','EXECUTE')
  THEN RAISE EXCEPTION 'allocation/polling privilege escalation'; END IF;
END;
$acl$;

SET LOCAL ROLE authenticated;
DO $tamper$
BEGIN
  BEGIN
    PERFORM public.match_queue_allocate();
    RAISE EXCEPTION 'browser allocated a match and private seed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.match_queue_status('50000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'browser enumerated another users match';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$tamper$;
RESET ROLE;
ROLLBACK;
