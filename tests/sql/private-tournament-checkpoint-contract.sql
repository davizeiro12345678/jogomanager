-- Run only in the disposable CI Supabase database, then rollback all fixtures.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id,email,email_confirmed_at)
VALUES ('80000000-0000-4000-8000-000000000001','tournament-owner@example.test',now()),
       ('80000000-0000-4000-8000-000000000002','tournament-guest@example.test',now());

DO $access$
BEGIN
  IF has_table_privilege('anon','matchmaking_private.tournament_checkpoints','SELECT')
    OR has_table_privilege('authenticated','matchmaking_private.tournament_checkpoints','SELECT')
    OR has_table_privilege('authenticated','matchmaking_private.tournament_checkpoints','UPDATE')
    OR has_function_privilege('authenticated',
      'public.save_private_tournament_checkpoint(uuid,uuid,text,bigint,jsonb,boolean)','EXECUTE')
    OR has_function_privilege('anon',
      'public.get_private_tournament_checkpoint(uuid)','EXECUTE')
    OR NOT has_function_privilege('service_role',
      'public.save_private_tournament_checkpoint(uuid,uuid,text,bigint,jsonb,boolean)','EXECUTE')
  THEN RAISE EXCEPTION 'private tournament RLS/ACL regression'; END IF;
END;
$access$;

SET LOCAL ROLE service_role;
DO $test$
DECLARE
  v_id uuid := '80000000-0000-4000-8000-000000000003';
  v_owner uuid := '80000000-0000-4000-8000-000000000001';
  v_first jsonb := '{"version":1,"entrants":["80000000-0000-4000-8000-000000000001","80000000-0000-4000-8000-000000000002"],"results":[],"pendingRooms":[]}'::jsonb;
  v_next jsonb;
  v_out jsonb;
  v_rejected boolean;
BEGIN
  v_out := public.save_private_tournament_checkpoint(v_id,v_owner,'sa',-1,v_first,false);
  IF v_out->>'status'<>'created' OR (v_out->>'revision')::int<>0
    THEN RAISE EXCEPTION 'tournament was not created'; END IF;
  v_out := public.save_private_tournament_checkpoint(v_id,v_owner,'sa',-1,v_first,false);
  IF v_out->>'status'<>'already_saved' THEN RAISE EXCEPTION 'non-idempotent create'; END IF;
  v_next := jsonb_set(v_first,'{pendingRooms}',
    '[{"matchId":"r1m1","roomId":"80000000-0000-4000-8000-000000000004"}]'::jsonb);
  v_out := public.save_private_tournament_checkpoint(v_id,v_owner,'sa',0,v_next,false);
  IF v_out->>'status'<>'saved' OR (v_out->>'revision')::int<>1
    THEN RAISE EXCEPTION 'tournament CAS update failed'; END IF;
  v_out := public.save_private_tournament_checkpoint(v_id,v_owner,'sa',0,v_next,false);
  IF v_out->>'status'<>'already_saved' THEN RAISE EXCEPTION 'retry duplicated CAS revision'; END IF;
  v_rejected:=false;
  BEGIN
    PERFORM public.save_private_tournament_checkpoint(v_id,v_owner,'sa',0,v_first,false);
  EXCEPTION WHEN serialization_failure THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'stale tournament writer overwrote checkpoint'; END IF;
  IF (public.get_private_tournament_checkpoint(v_id)->>'revision')::int<>1
    THEN RAISE EXCEPTION 'tournament snapshot revision not readable'; END IF;
  v_out := public.save_private_tournament_checkpoint(v_id,v_owner,'sa',1,v_next,true);
  IF v_out->>'status'<>'saved' OR (v_out->>'revision')::int<>2
    THEN RAISE EXCEPTION 'tournament finalization failed'; END IF;
  v_rejected:=false;
  BEGIN
    PERFORM public.save_private_tournament_checkpoint(v_id,v_owner,'sa',2,v_first,false);
  EXCEPTION WHEN check_violation THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'completed tournament reopened'; END IF;
  v_rejected:=false;
  BEGIN
    PERFORM public.save_private_tournament_checkpoint(
      '80000000-0000-4000-8000-000000000005',v_owner,'sa',-1,
      v_first || '{"seed":"leak"}'::jsonb,false);
  EXCEPTION WHEN invalid_parameter_value THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'invalid checkpoint with private field accepted'; END IF;
END;
$test$;
RESET ROLE;
ROLLBACK;
