\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Disposable local database only. Every fixture and receipt rolls back.
-- Real joined rooms are created by the trusted server, not a browser insert.
SET LOCAL ROLE service_role;
INSERT INTO public.match_rooms(id,code,host_id,guest_id,host_club,guest_club,seed,status,server_seeded) VALUES
 ('10000000-0000-4000-8000-000000000091','CHATADMIT1','00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000092','ARS','CHE','','ready',true),
 ('10000000-0000-4000-8000-000000000092','CHATADMIT2','00000000-0000-4000-8000-000000000091',NULL,'ARS',NULL,'','done',true);

SET LOCAL ROLE service_role;
DO $test$
DECLARE
  actor uuid := '00000000-0000-4000-8000-000000000091';
  room uuid := '10000000-0000-4000-8000-000000000091';
  message uuid := '20000000-0000-4000-8000-000000000091';
  rejected uuid := '20000000-0000-4000-8000-000000000092';
  result jsonb; token uuid; original_token uuid;
BEGIN
  result := public.admit_room_chat_message(actor,room,message,repeat('a',64),repeat('b',64),NULL);
  IF result->>'status' <> 'leased' THEN RAISE EXCEPTION 'first admission not leased: %', result; END IF;
  token := (result->>'leaseToken')::uuid;
  original_token := token;
  result := public.admit_room_chat_message(actor,room,message,repeat('a',64),repeat('b',64),NULL);
  IF result->>'status' <> 'pending' THEN RAISE EXCEPTION 'concurrent receipt not pending'; END IF;
  IF (SELECT attempts FROM room_chat_private.admissions WHERE user_id=actor AND message_id=message) <> 1
    THEN RAISE EXCEPTION 'replay consumed another attempt'; END IF;
  result := public.admit_room_chat_message(actor,room,message,repeat('c',64),repeat('b',64),NULL);
  IF result->>'status' <> 'conflict' THEN RAISE EXCEPTION 'changed text reused receipt'; END IF;
  IF public.finish_room_chat_message(actor,message,gen_random_uuid(),true)
    THEN RAISE EXCEPTION 'wrong lease finalized receipt'; END IF;
  UPDATE room_chat_private.admissions SET lease_until=now()-interval '1 second'
    WHERE user_id=actor AND message_id=message;
  result := public.admit_room_chat_message(actor,room,message,repeat('a',64),repeat('b',64),NULL);
  IF result->>'status' <> 'leased' THEN RAISE EXCEPTION 'expired lease did not recover'; END IF;
  token := (result->>'leaseToken')::uuid;
  IF token=original_token THEN RAISE EXCEPTION 'lease token reused'; END IF;
  IF public.finish_room_chat_message(actor,message,original_token,true)
    THEN RAISE EXCEPTION 'stale worker finalized newer lease'; END IF;
  IF NOT public.finish_room_chat_message(actor,message,token,true)
    THEN RAISE EXCEPTION 'valid lease did not finalize'; END IF;
  result := public.admit_room_chat_message(actor,room,message,repeat('a',64),repeat('b',64),NULL);
  IF result->>'status' <> 'sent' THEN RAISE EXCEPTION 'delivered receipt was not idempotent'; END IF;

  -- Simulate the following rate bucket without sleeping or changing server code.
  PERFORM pg_sleep(1.05);
  result := public.admit_room_chat_message(actor,room,rejected,repeat('d',64),repeat('b',64),NULL);
  IF result->>'status' <> 'blocked' OR result->>'rule' <> 'repeated'
    THEN RAISE EXCEPTION 'room repetition was not blocked'; END IF;
  IF (SELECT count(*) FROM public.chat_infractions WHERE user_id=actor) <> 1
    THEN RAISE EXCEPTION 'repeat infraction missing'; END IF;
  PERFORM pg_sleep(1.05);
  result := public.admit_room_chat_message(actor,room,rejected,repeat('d',64),repeat('b',64),NULL);
  IF result->>'status' <> 'blocked' OR result->>'rule' <> 'repeated'
    THEN RAISE EXCEPTION 'blocked retry changed its terminal decision'; END IF;
  IF (SELECT count(*) FROM public.chat_infractions WHERE user_id=actor) <> 1
    THEN RAISE EXCEPTION 'blocked retry duplicated an infraction after a bucket change'; END IF;
  IF EXISTS(SELECT 1 FROM room_chat_private.actor_limits WHERE user_id=actor
    AND second_bucket=floor(extract(epoch FROM clock_timestamp())))
    THEN RAISE EXCEPTION 'blocked retry consumed another rate bucket'; END IF;

  result := public.admit_room_chat_message('00000000-0000-4000-8000-000000000099',room,gen_random_uuid(),repeat('e',64),NULL,NULL);
  IF result->>'status' <> 'room_unavailable' THEN RAISE EXCEPTION 'foreign member admitted'; END IF;
  result := public.admit_room_chat_message(actor,'10000000-0000-4000-8000-000000000092',gen_random_uuid(),repeat('e',64),NULL,NULL);
  IF result->>'status' <> 'room_unavailable' THEN RAISE EXCEPTION 'closed room admitted'; END IF;

  INSERT INTO public.chat_infractions(user_id,reason) VALUES(actor,'link'),(actor,'link');
  result := public.admit_room_chat_message(actor,room,gen_random_uuid(),repeat('e',64),NULL,NULL);
  IF result->>'status' <> 'muted' THEN RAISE EXCEPTION 'persistent mute bypassed'; END IF;
  DELETE FROM public.chat_infractions WHERE user_id=actor;

  INSERT INTO room_chat_private.actor_limits(user_id,second_bucket)
    VALUES(actor,floor(extract(epoch FROM clock_timestamp())))
    ON CONFLICT(user_id) DO UPDATE SET second_bucket=excluded.second_bucket;
  result := public.admit_room_chat_message(actor,room,gen_random_uuid(),repeat('e',64),NULL,NULL);
  IF result->>'status' <> 'rate_limited' THEN RAISE EXCEPTION 'per-actor rate bypass'; END IF;
  DELETE FROM room_chat_private.actor_limits WHERE user_id=actor;

  UPDATE room_chat_private.admissions SET created_at=now()-interval '25 hours'
    WHERE user_id=actor AND message_id=message;
  result := public.admit_room_chat_message(actor,room,message,repeat('a',64),repeat('b',64),NULL);
  IF result->>'status' <> 'expired' THEN RAISE EXCEPTION 'expired receipt replayed'; END IF;
  PERFORM public.prune_room_chat_receipts(1000);
  IF EXISTS(SELECT 1 FROM room_chat_private.admissions WHERE user_id=actor AND message_id=message)
    THEN RAISE EXCEPTION 'retention failed'; END IF;
END;
$test$;

DO $test$
DECLARE
  actor uuid := '00000000-0000-4000-8000-000000000092';
  room uuid := '10000000-0000-4000-8000-000000000091';
  result jsonb;
BEGIN
  INSERT INTO room_chat_private.admissions(user_id,message_id,room_id,payload_hash,created_at)
    SELECT actor, ('30000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
      room,repeat('a',64),now()-interval '10 seconds' FROM generate_series(1,20) i;
  result := public.admit_room_chat_message(actor,room,gen_random_uuid(),repeat('f',64),NULL,NULL);
  IF result->>'status' <> 'rate_limited' THEN RAISE EXCEPTION 'twenty-per-minute limit bypassed'; END IF;
  DELETE FROM room_chat_private.actor_limits WHERE user_id=actor;
  UPDATE room_chat_private.admissions SET created_at=now()-interval '2 minutes' WHERE user_id=actor;
  INSERT INTO room_chat_private.admissions(user_id,message_id,room_id,payload_hash,created_at)
    SELECT actor, ('30000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
      room,repeat('a',64),now()-interval '2 minutes' FROM generate_series(21,200) i;
  result := public.admit_room_chat_message(actor,room,gen_random_uuid(),repeat('f',64),NULL,NULL);
  IF result->>'status' <> 'rate_limited' THEN RAISE EXCEPTION 'two-hundred-per-hour limit bypassed'; END IF;
END $test$;

DO $test$ BEGIN
  IF has_schema_privilege('anon','room_chat_private','USAGE')
    OR has_schema_privilege('authenticated','room_chat_private','USAGE')
    OR has_table_privilege('anon','room_chat_private.admissions','SELECT')
    OR has_table_privilege('authenticated','room_chat_private.admissions','INSERT')
    OR has_function_privilege('authenticated','public.admit_room_chat_message(uuid,uuid,uuid,text,text,text)','EXECUTE')
    OR has_function_privilege('anon','public.finish_room_chat_message(uuid,uuid,uuid,boolean)','EXECUTE')
  THEN RAISE EXCEPTION 'browser role can access private room admission'; END IF;
  IF NOT has_function_privilege('service_role','public.admit_room_chat_message(uuid,uuid,uuid,text,text,text)','EXECUTE')
    THEN RAISE EXCEPTION 'server cannot admit room chat'; END IF;
END $test$;
SET LOCAL ROLE authenticated;
DO $test$ BEGIN
  BEGIN
    PERFORM public.admit_room_chat_message('00000000-0000-4000-8000-000000000091',
      '10000000-0000-4000-8000-000000000091',gen_random_uuid(),repeat('a',64),NULL,NULL);
    RAISE EXCEPTION 'browser invoked authoritative admission';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM 1 FROM room_chat_private.admissions;
    RAISE EXCEPTION 'browser read opaque room receipts';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $test$;
RESET ROLE;
ROLLBACK;
