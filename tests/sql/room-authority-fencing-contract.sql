-- Isolated test database after migration 0077. ROLLBACK all fixtures.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('70000000-0000-4000-8000-000000000001','guard-home@example.test',now()),
 ('70000000-0000-4000-8000-000000000002','guard-away@example.test',now());

DO $verified$
DECLARE
  v_claim jsonb;
  v_room uuid;
  v_settled jsonb;
  v_denied boolean := false;
BEGIN
  PERFORM public.match_queue_join('70000000-0000-4000-8000-000000000001','ARS','ranked','sa');
  PERFORM public.match_queue_join('70000000-0000-4000-8000-000000000002','CHE','ranked','sa');
  v_claim := public.match_queue_allocate();
  IF v_claim->>'status'<>'allocated' THEN
    RAISE EXCEPTION 'ranked allocator returned %',v_claim;
  END IF;
  v_room := (v_claim->>'roomId')::uuid;
  IF (SELECT settlement_authority FROM public.match_rooms WHERE id=v_room)<>'websocket'
  THEN RAISE EXCEPTION 'ranked room not protected by WS settlement trigger'; END IF;

  BEGIN
    UPDATE public.match_rooms SET status='done',state='{"hg":99,"ag":0}'::jsonb
      WHERE id=v_room;
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'legacy server handler overwrote an authoritative scoreboard';
  END IF;
  v_settled := public.settle_authoritative_match(
    v_room,'70000000-0000-4000-8000-000000000010',
    repeat('a',64),repeat('A',43),'contact-2','completed',1,0,90
  );
  IF v_settled->>'status'<>'settled' OR
     (SELECT state->>'hg' FROM public.match_rooms WHERE id=v_room)<>'1'
  THEN RAISE EXCEPTION 'guard blocked the signed settlement RPC'; END IF;
END;
$verified$;

-- Manual legacy lobby must remain compatible with historical host replay.
INSERT INTO public.match_rooms(
 id,code,host_id,host_club,seed,status,server_seeded
) VALUES (
 '70000000-0000-4000-8000-000000000011','GUARD001',
 '70000000-0000-4000-8000-000000000001',
 'ARS','','open',true
);
UPDATE public.match_rooms SET
  guest_id='70000000-0000-4000-8000-000000000002',
  guest_club='CHE',status='ready'
  WHERE id='70000000-0000-4000-8000-000000000011';
UPDATE public.match_rooms SET status='live'
  WHERE id='70000000-0000-4000-8000-000000000011';
DO $legacy$
DECLARE v_denied boolean := false;
BEGIN
  IF (SELECT settlement_authority FROM public.match_rooms
      WHERE id='70000000-0000-4000-8000-000000000011')<>'legacy'
  THEN RAISE EXCEPTION 'manual private room unexpectedly upgraded'; END IF;
  BEGIN
    PERFORM public.settle_authoritative_match(
      '70000000-0000-4000-8000-000000000011',
      '70000000-0000-4000-8000-000000000012',
      repeat('a',64),repeat('A',43),'contact-2','completed',1,0,90
    );
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'legacy room got unauthorized WS receipt'; END IF;
  UPDATE public.match_rooms SET status='done'
    WHERE id='70000000-0000-4000-8000-000000000011';
  IF (SELECT status FROM public.match_rooms
      WHERE id='70000000-0000-4000-8000-000000000011')<>'done'
  THEN RAISE EXCEPTION 'historical legacy finishing is broken'; END IF;
END;
$legacy$;

-- The GUC is NOT an authentication token. A browser can call set_config()
-- in its own SQL transaction; deliberately grant temporary UPDATE and disable
-- RLS only in this rolled-back fixture to test the trigger itself.
SET LOCAL ROLE service_role;
INSERT INTO public.match_rooms(
  id,code,host_id,guest_id,host_club,guest_club,seed,status,server_seeded
) VALUES (
  '70000000-0000-4000-8000-000000000013','GUARD002',
  '70000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000002',
  'ARS','CHE','','live',true
);
RESET ROLE;
ALTER TABLE public.match_rooms DISABLE ROW LEVEL SECURITY;
GRANT SELECT,UPDATE ON public.match_rooms TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'matchmaking_private.settling_room',
  '70000000-0000-4000-8000-000000000013',
  true
);
DO $guc_spoof$
DECLARE v_denied boolean := false;
BEGIN
  BEGIN
    UPDATE public.match_rooms SET
      status='done',state='{"hg":99,"ag":0}'::jsonb
      WHERE id='70000000-0000-4000-8000-000000000013';
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'browser forged settlement GUC to overwrite websocket result';
  END IF;
END;
$guc_spoof$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $attacker$
BEGIN
  BEGIN
    UPDATE public.match_rooms SET settlement_authority='websocket'
      WHERE id='70000000-0000-4000-8000-000000000011';
    RAISE EXCEPTION 'browser modified settlement protocol';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$attacker$;
RESET ROLE;
ROLLBACK;
