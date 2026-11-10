\set ON_ERROR_STOP on
-- Disposable local replay database only. No outbound requests; all rows roll back.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $privileges$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    ASSERT NOT has_table_privilege(role_name, 'public.support_tickets', 'SELECT,INSERT,UPDATE,DELETE');
    ASSERT NOT has_table_privilege(role_name, 'public.support_delivery_outbox', 'SELECT,INSERT,UPDATE,DELETE');
    ASSERT NOT has_function_privilege(role_name, 'public.create_support_ticket(uuid,text,uuid,text,text,text)', 'EXECUTE');
    ASSERT NOT has_function_privilege(role_name, 'public.claim_support_deliveries(integer,uuid)', 'EXECUTE');
    ASSERT NOT has_function_privilege(role_name, 'public.complete_support_delivery(uuid,uuid,boolean,text,boolean)', 'EXECUTE');
  END LOOP;
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.support_tickets'::regclass);
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.support_delivery_outbox'::regclass);
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.create_support_ticket(uuid,text,uuid,text,text,text)'::regprocedure);
END;
$privileges$;

SELECT set_config('jogomanager.test.support_user', gen_random_uuid()::text, true);
INSERT INTO auth.users(id, email, raw_user_meta_data, email_confirmed_at)
VALUES(current_setting('jogomanager.test.support_user')::uuid, 'support-fixture@example.invalid', '{}'::jsonb, now());
SET LOCAL ROLE service_role;

DO $lifecycle$
DECLARE
  v_user uuid := current_setting('jogomanager.test.support_user')::uuid;
  v_request uuid := gen_random_uuid();
  v_id uuid;
  v_repeated uuid;
  v_status text;
  v_lease record;
  v_new_lease record;
BEGIN
  SELECT ticket_id, status INTO v_id, v_status FROM public.create_support_ticket(
    v_user, 'owner@example.invalid', v_request, 'gameplay', 'Partida travou', 'A partida travou durante o segundo tempo.');
  ASSERT v_status = 'queued';
  SELECT ticket_id INTO v_repeated FROM public.create_support_ticket(
    v_user, 'owner@example.invalid', v_request, 'gameplay', 'Partida travou', 'A partida travou durante o segundo tempo.');
  ASSERT v_id = v_repeated, 'retries must reuse the durable ticket';
  ASSERT (SELECT count(*) FROM public.support_delivery_outbox WHERE ticket_id = v_id) = 1;

  BEGIN
    PERFORM public.create_support_ticket(v_user, 'owner@example.invalid', v_request, 'gameplay', 'Different subject', 'A partida travou durante o segundo tempo.');
    RAISE EXCEPTION 'mismatched idempotent payload unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    ASSERT SQLERRM = 'support_request_mismatch';
  END;
  FOR i IN 1..2 LOOP
    PERFORM public.create_support_ticket(v_user, 'owner@example.invalid', gen_random_uuid(), 'account', 'Account support', 'This is another bounded support request.');
  END LOOP;
  BEGIN
    PERFORM public.create_support_ticket(v_user, 'owner@example.invalid', gen_random_uuid(), 'account', 'Account support', 'This fourth request must hit the hourly limit.');
    RAISE EXCEPTION 'fourth request unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN ASSERT SQLERRM = 'support_rate_limited'; END;

  SELECT * INTO v_lease FROM public.claim_support_deliveries(1, v_id);
  ASSERT v_lease.ticket_id = v_id AND v_lease.attempts = 1 AND v_lease.lease_token IS NOT NULL;
  ASSERT NOT EXISTS (SELECT 1 FROM public.claim_support_deliveries(1, v_id)), 'active leases cannot be claimed twice';
  ASSERT NOT public.complete_support_delivery(v_id, gen_random_uuid(), true), 'wrong lease token cannot mark delivery';
  ASSERT public.complete_support_delivery(v_id, v_lease.lease_token, false, 'http_503', true);
  ASSERT (SELECT status FROM public.support_delivery_outbox WHERE ticket_id = v_id) = 'pending';
  ASSERT NOT EXISTS (SELECT 1 FROM public.claim_support_deliveries(1, v_id)), 'backoff prevents an immediate retry';
  ASSERT (SELECT delivered_at FROM public.support_tickets WHERE id = v_id) IS NULL;

  UPDATE public.support_delivery_outbox SET next_attempt_at = clock_timestamp() - interval '1 second' WHERE ticket_id = v_id;
  SELECT * INTO v_new_lease FROM public.claim_support_deliveries(1, v_id);
  ASSERT v_new_lease.attempts = 2 AND v_new_lease.lease_token <> v_lease.lease_token;
  ASSERT NOT public.complete_support_delivery(v_id, v_lease.lease_token, true), 'stale workers must remain fenced';
  ASSERT public.complete_support_delivery(v_id, v_new_lease.lease_token, true);
  ASSERT (SELECT delivered_at FROM public.support_tickets WHERE id = v_id) IS NOT NULL;
  ASSERT NOT EXISTS (SELECT 1 FROM public.claim_support_deliveries(1, v_id));
  SELECT status INTO v_status FROM public.create_support_ticket(
    v_user, 'owner@example.invalid', v_request, 'gameplay', 'Partida travou', 'A partida travou durante o segundo tempo.');
  ASSERT v_status = 'delivered', 'idempotent creation must preserve delivery status';

  SELECT id INTO v_id FROM public.support_tickets WHERE user_id = v_user AND id <> v_id LIMIT 1;
  UPDATE public.support_delivery_outbox SET status = 'processing', attempts = 4,
    lease_token = gen_random_uuid(), lease_expires_at = clock_timestamp() - interval '1 second' WHERE ticket_id = v_id;
  SELECT * INTO v_lease FROM public.claim_support_deliveries(1, v_id);
  ASSERT v_lease.attempts = 5, 'crashed workers can be reclaimed only within the attempt cap';
  ASSERT public.complete_support_delivery(v_id, v_lease.lease_token, false, 'network_or_timeout', true);
  ASSERT (SELECT status FROM public.support_delivery_outbox WHERE ticket_id = v_id) = 'failed';
  ASSERT NOT EXISTS (SELECT 1 FROM public.claim_support_deliveries(1, v_id));
END;
$lifecycle$;
ROLLBACK;
