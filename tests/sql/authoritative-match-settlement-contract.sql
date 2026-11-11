-- Disposable Postgres replay, no external provider or production settlement.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('60000000-0000-4000-8000-000000000001','score-home@example.test',now()),
 ('60000000-0000-4000-8000-000000000002','score-away@example.test');
INSERT INTO matchmaking_private.ratings(user_id,rating) VALUES
 ('60000000-0000-4000-8000-000000000001',1400),
 ('60000000-0000-4000-8000-000000000002',1400);
INSERT INTO public.match_rooms(
  id,code,host_id,guest_id,host_club,guest_club,status,seed,server_seeded
) VALUES (
 '60000000-0000-4000-8000-000000000010','SCORE001',
 '60000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000002',
 'ARS','CHE','live','',true
);
INSERT INTO public.match_room_secrets(room_id,seed)
VALUES ('60000000-0000-4000-8000-000000000010','test-private-staging-seed-000123');
INSERT INTO matchmaking_private.pairs(
  home_id,away_id,home_club,away_club,mode,status,room_id
) VALUES (
 '60000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000002',
 'ARS','CHE','ranked','committed',
 '60000000-0000-4000-8000-000000000010'
);

DO $contract$
DECLARE
  v_room uuid := '60000000-0000-4000-8000-000000000010';
  v_receipt uuid := '60000000-0000-4000-8000-000000000011';
  v_first jsonb;
  v_duplicate jsonb;
  v_result record;
  denied boolean := false;
BEGIN
  v_first := public.settle_authoritative_match(
    v_room,v_receipt,repeat('a',64),repeat('A',43),
    'contact-2','completed',2,1,90
  );
  IF v_first->>'status'<>'settled' OR v_first->>'ranking'<>'applied'
     OR (v_first->>'ratingDelta')::integer<>16
  THEN RAISE EXCEPTION 'ranked settlement failed: %',v_first; END IF;
  SELECT * INTO v_result FROM public.match_rooms WHERE id=v_room;
  IF v_result.status<>'done' OR v_result.minute<>90 OR
    v_result.state->>'hg'<>'2' OR v_result.state->>'ag'<>'1'
  THEN RAISE EXCEPTION 'room scoreboard not committed'; END IF;
  IF EXISTS (SELECT 1 FROM public.match_room_secrets WHERE room_id=v_room)
  THEN RAISE EXCEPTION 'private match seed not deleted after settlement'; END IF;
  IF (SELECT rating FROM matchmaking_private.ratings
      WHERE user_id='60000000-0000-4000-8000-000000000001')<>1416 OR
     (SELECT rating FROM matchmaking_private.ratings
      WHERE user_id='60000000-0000-4000-8000-000000000002')<>1384
  THEN RAISE EXCEPTION 'ratings were not adjusted by symmetric Elo'; END IF;
  v_duplicate := public.settle_authoritative_match(
    v_room,v_receipt,repeat('a',64),repeat('A',43),
    'contact-2','completed',2,1,90
  );
  IF v_duplicate->>'status'<>'already_settled' THEN
    RAISE EXCEPTION 'idempotent settlement was not recognized'; END IF;
  IF (SELECT sum(games_played) FROM matchmaking_private.ratings
      WHERE user_id IN (
        '60000000-0000-4000-8000-000000000001',
        '60000000-0000-4000-8000-000000000002'
      ))<>2
  THEN RAISE EXCEPTION 'duplicate settlement changed ratings'; END IF;
  BEGIN
    PERFORM public.settle_authoritative_match(
      v_room,v_receipt,repeat('b',64),repeat('A',43),
      'contact-2','completed',2,1,90
    );
  EXCEPTION WHEN unique_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'conflicting command hash accepted'; END IF;
  IF (SELECT count(*) FROM matchmaking_private.authoritative_results
      WHERE room_id=v_room)<>1
  THEN RAISE EXCEPTION 'more than one authoritative result per room'; END IF;
END;
$contract$;

-- An already closed room without a previously signed receipt cannot create
-- awards out of thin air, even when called from the backend service.
DO $closed$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.settle_authoritative_match(
      '60000000-0000-4000-8000-000000000010',
      '60000000-0000-4000-8000-000000000020',
      repeat('a',64),repeat('A',43),'contact-2','forfeit',3,0,90
    );
  EXCEPTION WHEN unique_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'second receipt changed a finalized room'; END IF;
END;
$closed$;

DO $permissions$
BEGIN
  IF has_function_privilege(
    'authenticated',
    'public.settle_authoritative_match(uuid,uuid,text,text,text,text,integer,integer,integer)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.settle_authoritative_match(uuid,uuid,text,text,text,text,integer,integer,integer)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'service_role',
    'public.settle_authoritative_match(uuid,uuid,text,text,text,text,integer,integer,integer)',
    'EXECUTE'
  ) THEN RAISE EXCEPTION 'authoritative receipt exposed to untrusted roles'; END IF;
END;
$permissions$;

SET LOCAL ROLE authenticated;
DO $forgery$
BEGIN
  BEGIN
    PERFORM public.settle_authoritative_match(
      '60000000-0000-4000-8000-000000000010',
      '60000000-0000-4000-8000-000000000030',
      repeat('a',64),repeat('A',43),'contact-2','completed',99,0,90
    );
    RAISE EXCEPTION 'browser forged an official result';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$forgery$;
RESET ROLE;
ROLLBACK;
