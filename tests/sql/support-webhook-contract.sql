\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $grants$
BEGIN
  ASSERT NOT has_schema_privilege('anon', 'support_private', 'USAGE');
  ASSERT NOT has_schema_privilege('authenticated', 'support_private', 'USAGE');
  ASSERT NOT has_table_privilege('authenticated', 'support_private.requests', 'SELECT,INSERT,UPDATE,DELETE');
  ASSERT NOT has_function_privilege('anon', 'public.reserve_support_request(uuid,uuid,text,jsonb)', 'EXECUTE');
  ASSERT NOT has_function_privilege('authenticated', 'public.reserve_support_request(uuid,uuid,text,jsonb)', 'EXECUTE');
  ASSERT NOT has_function_privilege('authenticated', 'public.finish_support_request(uuid,uuid,uuid,boolean)', 'EXECUTE');
  ASSERT has_function_privilege('service_role', 'public.reserve_support_request(uuid,uuid,text,jsonb)', 'EXECUTE');
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.reserve_support_request(uuid,uuid,text,jsonb)'::regprocedure);
END;
$grants$;
SELECT set_config('jogomanager.test.support_user', gen_random_uuid()::text, true);
INSERT INTO auth.users (id, email) VALUES (current_setting('jogomanager.test.support_user')::uuid, 'support-fixture@example.invalid');
SET LOCAL ROLE service_role;
DO $delivery$
DECLARE
  actor uuid := current_setting('jogomanager.test.support_user')::uuid;
  request_id uuid := gen_random_uuid();
  retry_id uuid := gen_random_uuid();
  first jsonb;
  result jsonb;
  payload jsonb := '{"email":"support-fixture@example.invalid","category":"bug","message":"Synthetic support fixture with twenty characters."}';
BEGIN
  first := public.reserve_support_request(actor, request_id, repeat('a',64), payload);
  ASSERT first->>'status' = 'leased';
  result := public.reserve_support_request(actor, request_id, repeat('a',64), payload);
  ASSERT result->>'status' = 'pending', 'concurrent duplicate must not acquire another lease';
  result := public.reserve_support_request(actor, request_id, repeat('b',64), payload);
  ASSERT result->>'status' = 'conflict', 'same id with changed content must not overwrite';
  ASSERT NOT public.finish_support_request(actor, request_id, gen_random_uuid(), true), 'wrong lease must not mark sent';
  ASSERT public.finish_support_request(actor, request_id, (first->>'leaseToken')::uuid, true);
  ASSERT NOT public.finish_support_request(actor, request_id, (first->>'leaseToken')::uuid, false), 'stale failure must not undo success';
  result := public.reserve_support_request(actor, request_id, repeat('a',64), payload);
  ASSERT result->>'status' = 'sent', 'delivered duplicate must not resend';
  result := public.reserve_support_request(actor, retry_id, repeat('a',64), payload);
  ASSERT public.finish_support_request(actor, retry_id, (result->>'leaseToken')::uuid, false);
  UPDATE support_private.requests AS q SET lease_until = now() - interval '1 second'
    WHERE q.user_id = actor AND q.request_id = retry_id;
  result := public.reserve_support_request(actor, retry_id, repeat('a',64), payload);
  ASSERT result->>'status' = 'leased', 'retry should reuse the hourly ticket';
  ASSERT public.finish_support_request(actor, retry_id, (result->>'leaseToken')::uuid, false);
  UPDATE support_private.requests AS q SET lease_until = now() - interval '1 second'
    WHERE q.user_id = actor AND q.request_id = retry_id;
  result := public.reserve_support_request(actor, retry_id, repeat('a',64), payload);
  ASSERT result->>'status' = 'leased';
  ASSERT public.finish_support_request(actor, retry_id, (result->>'leaseToken')::uuid, false);
  UPDATE support_private.requests AS q SET lease_until = now() - interval '1 second'
    WHERE q.user_id = actor AND q.request_id = retry_id;
  result := public.reserve_support_request(actor, retry_id, repeat('a',64), payload);
  ASSERT result->>'status' = 'unavailable', 'fourth lease must be refused';
  PERFORM public.reserve_support_request(actor, gen_random_uuid(), repeat('a',64), payload);
  result := public.reserve_support_request(actor, gen_random_uuid(), repeat('a',64), payload);
  ASSERT result->>'status' = 'rate_limited', 'fourth new ticket per hour must be refused';
  BEGIN
    PERFORM public.reserve_support_request(actor, gen_random_uuid(), repeat('a',64), payload - 'category');
    RAISE EXCEPTION 'missing category accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END;
$delivery$;
ROLLBACK;
