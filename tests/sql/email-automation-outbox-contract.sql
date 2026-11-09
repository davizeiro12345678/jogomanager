-- Disposable migrated database only. No network or real emails; every fixture rolls back.
BEGIN;
DO $permissions$
DECLARE fn regprocedure;
BEGIN
  ASSERT NOT has_schema_privilege('anon', 'email_automation_private', 'USAGE');
  ASSERT NOT has_schema_privilege('authenticated', 'email_automation_private', 'USAGE');
  FOREACH fn IN ARRAY ARRAY[
    'public.claim_email_automation()'::regprocedure,
    'public.complete_email_automation(uuid,uuid,text,integer,integer)'::regprocedure
  ] LOOP
    ASSERT NOT has_function_privilege('anon', fn, 'EXECUTE');
    ASSERT NOT has_function_privilege('authenticated', fn, 'EXECUTE');
    ASSERT has_function_privilege('service_role', fn, 'EXECUTE');
  END LOOP;
END;
$permissions$;

INSERT INTO auth.users(id, email, email_confirmed_at) VALUES
  ('65000000-0000-4000-8000-000000000001','confirmed@outbox.example.test',now()),
  ('65000000-0000-4000-8000-000000000002','unconfirmed@outbox.example.test',NULL);
DO $sources$
BEGIN
  ASSERT (SELECT count(*) FROM email_automation_private.outbox
    WHERE user_id = '65000000-0000-4000-8000-000000000001') = 1, 'Confirmed signup must enqueue exactly once';
  ASSERT NOT EXISTS (SELECT 1 FROM email_automation_private.outbox
    WHERE user_id = '65000000-0000-4000-8000-000000000002'), 'Unconfirmed address must never start onboarding';
END;
$sources$;
UPDATE auth.users SET email_confirmed_at = now() WHERE id = '65000000-0000-4000-8000-000000000001';
INSERT INTO public.user_purchases(id,user_id,product_key,amount_cents,status,reference)
VALUES ('65000000-0000-4000-8000-000000000003','65000000-0000-4000-8000-000000000001','coins_500',500,'pending','outbox-fixture-only');
DO $pending$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM email_automation_private.outbox WHERE event_name = 'purchase.fulfilled'
    AND source_id = '65000000-0000-4000-8000-000000000003'), 'Pending payment must not emit fulfillment';
END;
$pending$;
UPDATE public.user_purchases SET status = 'completed' WHERE id = '65000000-0000-4000-8000-000000000003';
UPDATE public.user_purchases SET status = 'completed' WHERE id = '65000000-0000-4000-8000-000000000003';
DO $dedup$
BEGIN
  ASSERT (SELECT count(*) FROM email_automation_private.outbox WHERE source_id = '65000000-0000-4000-8000-000000000003') = 1,
    'Repeated payment receipt must not enqueue duplicate notifications';
  ASSERT (SELECT count(*) FROM email_automation_private.outbox WHERE event_name = 'user.created'
    AND source_id = '65000000-0000-4000-8000-000000000001') = 1, 'Auth re-confirmation must deduplicate';
END;
$dedup$;

SAVEPOINT atomic_source;
INSERT INTO public.user_purchases(id,user_id,product_key,amount_cents,status,reference)
VALUES ('65000000-0000-4000-8000-000000000005','65000000-0000-4000-8000-000000000001','coins_500',500,'completed','outbox-rollback-fixture');
DO $atomic_insert$
BEGIN
  ASSERT EXISTS (SELECT 1 FROM email_automation_private.outbox WHERE source_id = '65000000-0000-4000-8000-000000000005');
END;
$atomic_insert$;
ROLLBACK TO SAVEPOINT atomic_source;
DO $atomic_rollback$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM email_automation_private.outbox WHERE source_id = '65000000-0000-4000-8000-000000000005'),
    'A rolled-back payment must not leave an automation to send';
END;
$atomic_rollback$;

-- Isolate the purchase fixture from any historical disposable fixtures.
UPDATE email_automation_private.outbox SET next_attempt_at = now() + interval '1 day'
  WHERE source_id <> '65000000-0000-4000-8000-000000000003';
DO $lease$
DECLARE v_lease jsonb; v_retry jsonb; v_id uuid; v_token uuid; v_second uuid;
BEGIN
  v_lease := public.claim_email_automation();
  ASSERT v_lease->>'event_name' = 'purchase.fulfilled';
  ASSERT v_lease->>'recipient_email' = 'confirmed@outbox.example.test';
  ASSERT v_lease->'payload' = jsonb_build_object('user_id','65000000-0000-4000-8000-000000000001','order_id','65000000-0000-4000-8000-000000000003');
  v_id := (v_lease->>'id')::uuid; v_token := (v_lease->>'lease_token')::uuid;
  ASSERT public.claim_email_automation() IS NULL, 'Concurrent invocation must not claim an active lease';
  ASSERT NOT public.complete_email_automation(v_id,gen_random_uuid(),'sent',202,0), 'Stale lease must not acknowledge';
  BEGIN
    PERFORM public.complete_email_automation(v_id,v_token,'retry',503,0);
    RAISE EXCEPTION 'Ambiguous 5xx accepted for automatic resend';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  ASSERT public.complete_email_automation(v_id,v_token,'retry',429,120);
  ASSERT (SELECT next_attempt_at >= clock_timestamp() + interval '119 seconds' FROM email_automation_private.outbox WHERE id = v_id),
    'Provider Retry-After must be honored';
  UPDATE email_automation_private.outbox SET next_attempt_at = now() - interval '1 second' WHERE id = v_id;
  UPDATE email_automation_private.dispatch_budget SET next_send_at = now() - interval '1 second';
  v_retry := public.claim_email_automation(); v_second := (v_retry->>'lease_token')::uuid;
  ASSERT v_retry->>'id' = v_lease->>'id' AND (v_retry->>'attempts')::integer = 2,
    'Rate-limit retry must retain stable idempotency identity';
  ASSERT NOT public.complete_email_automation(v_id,v_token,'sent',202,0), 'Old worker cannot finish a new lease';
  UPDATE email_automation_private.outbox SET lease_until = now() - interval '1 second' WHERE id = v_id;
  UPDATE email_automation_private.dispatch_budget SET next_send_at = now() - interval '1 second';
  ASSERT public.claim_email_automation() IS NULL, 'Expired lease may have sent; never automatically reclaim';
  ASSERT (SELECT status = 'uncertain' FROM email_automation_private.outbox WHERE id = v_id);
  ASSERT public.complete_email_automation(v_id,v_second,'sent',202,0), 'Same late worker may confirm provider acceptance';
  ASSERT public.complete_email_automation(v_id,v_second,'sent',202,0), 'Acknowledgement itself must be idempotent';
  ASSERT (SELECT status = 'sent' AND recipient_email IS NULL AND payload = '{}'::jsonb
    FROM email_automation_private.outbox WHERE id = v_id), 'Delivered rows retain dedup without recipient contents';
END;
$lease$;

DO $confirmation_and_caps$
DECLARE v_lease jsonb; v_id uuid;
BEGIN
  UPDATE auth.users SET email_confirmed_at = now() WHERE id = '65000000-0000-4000-8000-000000000002';
  UPDATE email_automation_private.outbox SET next_attempt_at = now() - interval '1 second'
    WHERE source_id = '65000000-0000-4000-8000-000000000002';
  UPDATE email_automation_private.dispatch_budget SET next_send_at = now() - interval '1 second', minute_reserved = 20;
  ASSERT public.claim_email_automation() IS NULL, 'Global minute cap must apply across workers';
  UPDATE email_automation_private.dispatch_budget SET minute_reserved = 0, hour_reserved = 120;
  ASSERT public.claim_email_automation() IS NULL, 'Global hourly cap must apply across workers';
  UPDATE email_automation_private.dispatch_budget SET hour_reserved = 0;
  v_lease := public.claim_email_automation(); v_id := (v_lease->>'id')::uuid;
  ASSERT v_lease->>'event_name' = 'user.created';
  ASSERT public.complete_email_automation(v_id,(v_lease->>'lease_token')::uuid,'retry',429,0);
  UPDATE auth.users SET email = 'changed@outbox.example.test' WHERE id = '65000000-0000-4000-8000-000000000002';
  UPDATE email_automation_private.outbox SET next_attempt_at = now() - interval '1 second' WHERE id = v_id;
  UPDATE email_automation_private.dispatch_budget SET next_send_at = now() - interval '1 second';
  ASSERT public.claim_email_automation() IS NULL, 'Retry must not retarget an already attempted email';
  ASSERT (SELECT status = 'dead' AND last_error = 'recipient_changed' FROM email_automation_private.outbox WHERE id = v_id);
END;
$confirmation_and_caps$;

INSERT INTO auth.users(id,email,email_confirmed_at,is_anonymous)
VALUES ('65000000-0000-4000-8000-000000000007','anonymous@outbox.example.test',now(),true);
INSERT INTO public.user_purchases(id,user_id,product_key,amount_cents,status,reference)
VALUES ('65000000-0000-4000-8000-000000000006','65000000-0000-4000-8000-000000000001','coins_500',500,'completed','outbox-retry-cap-fixture');
DO $retry_cap$
DECLARE v_lease jsonb; v_id uuid;
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM email_automation_private.outbox
    WHERE user_id = '65000000-0000-4000-8000-000000000007'), 'Anonymous Auth must not trigger onboarding';
  UPDATE email_automation_private.outbox SET attempts = 5
    WHERE source_id = '65000000-0000-4000-8000-000000000006';
  UPDATE email_automation_private.dispatch_budget SET next_send_at = now() - interval '1 second', minute_reserved = 0, hour_reserved = 0;
  UPDATE auth.users SET banned_until = now() + interval '1 day'
    WHERE id = '65000000-0000-4000-8000-000000000001';
  ASSERT public.claim_email_automation() IS NULL, 'Banned accounts must not receive queued notifications';
  UPDATE auth.users SET banned_until = NULL WHERE id = '65000000-0000-4000-8000-000000000001';
  v_lease := public.claim_email_automation(); v_id := (v_lease->>'id')::uuid;
  ASSERT (v_lease->>'attempts')::integer = 6;
  ASSERT public.complete_email_automation(v_id,(v_lease->>'lease_token')::uuid,'retry',429,0);
  ASSERT (SELECT status = 'dead' AND attempts = 6 FROM email_automation_private.outbox WHERE id = v_id),
    'Sixth rate limit must exhaust automatic retries';
END;
$retry_cap$;

SET LOCAL ROLE authenticated;
DO $attacker$
BEGIN
  BEGIN
    PERFORM public.claim_email_automation();
    RAISE EXCEPTION 'Client dispatched a private event';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.user_purchases(user_id,product_key,status) VALUES
      ('65000000-0000-4000-8000-000000000001','coins_500','completed');
    RAISE EXCEPTION 'Client forged fulfillment notification';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$attacker$;
RESET ROLE;
ROLLBACK;
