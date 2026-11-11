-- Canonical disposable database only, after forward migration 0074.
-- Exercises a real PostgreSQL reservation transaction; no public queue release.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('40000000-0000-4000-8000-000000000001','queue-one@example.test',now()),
 ('40000000-0000-4000-8000-000000000002','queue-two@example.test',now()),
 ('40000000-0000-4000-8000-000000000003','queue-three@example.test',now()),
 ('40000000-0000-4000-8000-000000000004','queue-four@example.test',now()),
 ('40000000-0000-4000-8000-000000000005','queue-five@example.test',now());

INSERT INTO matchmaking_private.ratings(user_id,rating) VALUES
 ('40000000-0000-4000-8000-000000000001',1400),
 ('40000000-0000-4000-8000-000000000002',2000),
 ('40000000-0000-4000-8000-000000000003',1410);

DO $contract$
DECLARE
  one uuid := '40000000-0000-4000-8000-000000000001';
  two uuid := '40000000-0000-4000-8000-000000000002';
  three uuid := '40000000-0000-4000-8000-000000000003';
  four uuid := '40000000-0000-4000-8000-000000000004';
  five uuid := '40000000-0000-4000-8000-000000000005';
  v_pair jsonb;
  v_id uuid;
  v_result jsonb;
  v_old timestamptz;
BEGIN
  v_result := public.match_queue_join(one,'ARS','ranked','sa');
  IF v_result->>'status'<>'waiting' OR (v_result->>'rating')::integer<>1400
  THEN RAISE EXCEPTION 'server rating mismatch'; END IF;
  SELECT joined_at INTO v_old FROM matchmaking_private.queue WHERE user_id=one;
  PERFORM public.match_queue_join(one,'ARS','ranked','sa');
  IF (SELECT joined_at FROM matchmaking_private.queue WHERE user_id=one)<>v_old
  THEN RAISE EXCEPTION 'rejoin spam reset rank priority'; END IF;

  PERFORM public.match_queue_join(two,'BAY','ranked','sa');
  PERFORM public.match_queue_join(three,'CHE','ranked','sa');
  v_pair := public.match_queue_claim();
  IF v_pair IS NULL OR v_pair->>'homeId'<>one::text
    OR v_pair->>'awayId'<>three::text
    OR (v_pair->>'ratingGap')::integer<>10
  THEN RAISE EXCEPTION 'oldest compatible ranked queue pair rejected: %',v_pair; END IF;
  v_id := (v_pair->>'pairId')::uuid;
  IF public.match_queue_claim() IS NOT NULL THEN
    RAISE EXCEPTION 'already leased seats were matched twice'; END IF;
  IF public.match_queue_leave(one) THEN
    RAISE EXCEPTION 'participant cancelled active reservation'; END IF;
  IF public.match_queue_confirm(v_id,gen_random_uuid()) THEN
    RAISE EXCEPTION 'unbound room improperly finalized pair'; END IF;

  IF NOT public.match_queue_release(v_id) OR public.match_queue_release(v_id) THEN
    RAISE EXCEPTION 'pair release was not idempotently fenced'; END IF;
  IF (SELECT count(*) FROM matchmaking_private.queue
      WHERE status='waiting' AND user_id IN(one,three))<>2
  THEN RAISE EXCEPTION 'released pair did not restore both seats'; END IF;
  INSERT INTO matchmaking_private.blocks(blocker_id,blocked_id) VALUES (one,three);
  IF public.match_queue_claim() IS NOT NULL THEN
    RAISE EXCEPTION 'blocked user became an opponent'; END IF;
  DELETE FROM matchmaking_private.blocks WHERE blocker_id=one AND blocked_id=three;

  v_pair := public.match_queue_claim();
  IF v_pair IS NULL THEN RAISE EXCEPTION 'released pair was not claimable'; END IF;
  v_id := (v_pair->>'pairId')::uuid;
  -- Simulate a legitimate server-created ready room under the existing
  -- anti-spoof room trigger, not as an authenticated browser.
  EXECUTE 'SET LOCAL ROLE service_role';
  INSERT INTO public.match_rooms (
    id,code,host_id,guest_id,host_club,guest_club,seed,status,server_seeded
  ) VALUES (
    '40000000-0000-4000-8000-000000000010','QUEUER001',one,three,'ARS','CHE','',
    'ready',true
  );
  EXECUTE 'RESET ROLE';
  IF NOT public.match_queue_confirm(v_id,'40000000-0000-4000-8000-000000000010') OR
     NOT public.match_queue_confirm(v_id,'40000000-0000-4000-8000-000000000010')
  THEN RAISE EXCEPTION 'valid room did not commit pair exactly once'; END IF;
  IF public.match_queue_confirm(v_id,gen_random_uuid()) THEN
    RAISE EXCEPTION 'pair committed against a second room'; END IF;
  IF (SELECT count(*) FROM matchmaking_private.queue WHERE user_id IN(one,three))<>0
  THEN RAISE EXCEPTION 'committed pair remained queued'; END IF;

  -- The server does not immediately re-pair the same two accounts.
  PERFORM public.match_queue_join(one,'ARS','ranked','sa');
  PERFORM public.match_queue_join(three,'CHE','ranked','sa');
  IF public.match_queue_claim() IS NOT NULL THEN
    RAISE EXCEPTION 'immediate rematch or impossible rating gap'; END IF;
  PERFORM public.match_queue_leave(one);
  PERFORM public.match_queue_leave(three);
  PERFORM public.match_queue_leave(two);

  PERFORM public.match_queue_join(four,'FRA','casual','sa');
  PERFORM public.match_queue_join(five,'ITA','casual','eu');
  IF public.match_queue_claim() IS NOT NULL THEN
    RAISE EXCEPTION 'premature cross-region match'; END IF;
  UPDATE matchmaking_private.queue SET joined_at=clock_timestamp()-interval '95 seconds'
    WHERE user_id IN(four,five);
  v_pair := public.match_queue_claim();
  IF v_pair IS NULL OR (v_pair->>'mode')<>'casual' THEN
    RAISE EXCEPTION 'cross-region fallback denied after waiting'; END IF;
END;
$contract$;

DO $acl$
DECLARE
  fn regprocedure;
BEGIN
  IF has_schema_privilege('anon','matchmaking_private','USAGE')
   OR has_schema_privilege('authenticated','matchmaking_private','USAGE')
   OR has_table_privilege('authenticated','matchmaking_private.queue','SELECT')
  THEN RAISE EXCEPTION 'browser can inspect matchmaking queue'; END IF;
  FOREACH fn IN ARRAY ARRAY[
    'public.match_queue_join(uuid,text,text,text)'::regprocedure,
    'public.match_queue_leave(uuid)'::regprocedure,
    'public.match_queue_claim()'::regprocedure,
    'public.match_queue_confirm(uuid,uuid)'::regprocedure,
    'public.match_queue_release(uuid)'::regprocedure
  ] LOOP
    IF has_function_privilege('anon',fn,'EXECUTE')
       OR has_function_privilege('authenticated',fn,'EXECUTE')
       OR NOT has_function_privilege('service_role',fn,'EXECUTE')
    THEN RAISE EXCEPTION 'incorrect queue RPC privileges: %',fn; END IF;
  END LOOP;
END;
$acl$;

SET LOCAL ROLE authenticated;
DO $tamper$
BEGIN
  BEGIN
    PERFORM public.match_queue_claim();
    RAISE EXCEPTION 'client claimed server queue';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO matchmaking_private.ratings(user_id,rating)
    VALUES ('40000000-0000-4000-8000-000000000001',5000);
    RAISE EXCEPTION 'client set own MMR';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$tamper$;
RESET ROLE;
ROLLBACK;
