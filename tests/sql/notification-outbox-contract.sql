-- Disposable local migration replay only. No real messages or provider requests.
BEGIN;
DO $tests$
DECLARE
  v_payload jsonb := '{"to":"qa@example.test","from":"no-reply@example.test","subject":"Notice","html":"<p>Notice</p>","text":"Notice"}'::jsonb;
  v_id uuid;
  v_retry uuid;
  v_claim record;
  v_reclaimed record;
  v_errors integer := 0;
BEGIN
  ASSERT NOT has_function_privilege('anon',
    'public.jm_queue_notification(text,text,jsonb,text)', 'EXECUTE'),
    'Queue is callable by anonymous users';
  ASSERT NOT has_function_privilege('authenticated',
    'public.jm_queue_notification(text,text,jsonb,text)', 'EXECUTE'),
    'Queue is callable by signed-in clients';

  v_id := public.jm_queue_notification(
    repeat('a', 64), 'welcome', v_payload, repeat('b', 32));
  ASSERT v_id IS NOT NULL, 'enqueue did not create a job';
  ASSERT public.jm_queue_notification(
    repeat('a', 64), 'welcome', v_payload, repeat('b', 32)) = v_id,
    'duplicate enqueue must return the original job';

  SELECT * INTO v_claim FROM public.jm_claim_notifications(5);
  ASSERT v_claim.id = v_id, 'claim returned unexpected job';
  ASSERT v_claim.trace_id = repeat('b', 32), 'trace lost across claim';
  ASSERT public.jm_ack_notification(v_id, gen_random_uuid(), true) = false,
    'stale worker must not acknowledge a lease';
  ASSERT public.jm_ack_notification(v_id, v_claim.lease_token, true) = true,
    'owner could not acknowledge delivery';
  ASSERT (SELECT payload FROM notification_private.outbox WHERE id=v_id) = '{}'::jsonb,
    'delivered contents must be scrubbed';
  ASSERT public.jm_queue_notification(
    repeat('a', 64), 'welcome', v_payload, repeat('b', 32)) = v_id,
    'dedupe must work after content scrubbing';
  ASSERT public.jm_ack_notification(v_id, v_claim.lease_token, true) = false,
    'completed job cannot be acknowledged twice';

  BEGIN
    PERFORM public.jm_queue_notification(
      repeat('a', 64), 'welcome', v_payload || '{"subject":"different"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors + 1;
  END;
  ASSERT v_errors = 1, 'changed payload reused the idempotency key';

  v_retry := public.jm_queue_notification(
    repeat('c', 64), 'season-start', v_payload);
  SELECT * INTO v_claim FROM public.jm_claim_notifications(1);
  ASSERT v_claim.id = v_retry, 'second job not claimed';
  UPDATE notification_private.outbox
    SET lease_until = now() - interval '1 minute'
    WHERE id = v_retry;
  SELECT * INTO v_reclaimed FROM public.jm_claim_notifications(1);
  ASSERT v_reclaimed.id = v_retry, 'expired lease not reclaimed';
  ASSERT v_reclaimed.lease_token <> v_claim.lease_token, 'lease token not fenced';
  ASSERT public.jm_ack_notification(v_retry, v_claim.lease_token, true) = false,
    'old lease overwrote new claim';
  ASSERT public.jm_ack_notification(v_retry, v_reclaimed.lease_token, false,
    'temporary provider failure') = true, 'failed job was not deferred';
  ASSERT (SELECT status FROM notification_private.outbox WHERE id = v_retry) = 'pending',
    'temporary failure must be retried';
END
$tests$;
ROLLBACK;
