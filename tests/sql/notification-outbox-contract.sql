-- Disposable database only. Every fixture and lease transition is rolled back.
BEGIN;

DO $contract$
DECLARE fn regprocedure;
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM notification_private.outbox), 'Requires a fresh replay database';
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid = 'notification_private.outbox'::regclass), 'Private queue must retain RLS';
  ASSERT NOT has_schema_privilege('anon', 'notification_private', 'USAGE');
  ASSERT NOT has_schema_privilege('authenticated', 'notification_private', 'USAGE');
  ASSERT NOT has_table_privilege('anon', 'notification_private.outbox', 'SELECT');
  ASSERT NOT has_table_privilege('authenticated', 'notification_private.outbox', 'SELECT');
  FOREACH fn IN ARRAY ARRAY[
    'public.jm_queue_notification(text,text,jsonb,text)'::regprocedure,
    'public.jm_claim_notifications(integer)'::regprocedure,
    'public.jm_ack_notification(uuid,uuid,boolean,text,boolean)'::regprocedure,
    'public.jm_reap_notifications()'::regprocedure
  ] LOOP
    ASSERT has_function_privilege('service_role', fn, 'EXECUTE'), 'Worker cannot call its RPC';
    ASSERT NOT has_function_privilege('anon', fn, 'EXECUTE'), 'Anonymous queue access';
    ASSERT NOT has_function_privilege('authenticated', fn, 'EXECUTE'), 'User queue access';
    ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = fn), 'Queue must not bypass caller grants';
  END LOOP;
END;
$contract$;

SET LOCAL ROLE service_role;
DO $contract$
DECLARE
  fixture_payload jsonb := '{"to":"fixture@example.invalid","from":"game@example.invalid","subject":"Season","html":"<p>Season ready</p>","text":"Season ready"}';
  event_id uuid; retry_id uuid; lease record; replacement record; rejected boolean;
BEGIN
  event_id := public.jm_queue_notification('contract-delivered', 'season-start', fixture_payload, repeat('a',32));
  ASSERT public.jm_queue_notification('contract-delivered', 'season-start', fixture_payload) = event_id, 'Pending enqueue must deduplicate';
  SELECT * INTO STRICT lease FROM public.jm_claim_notifications(5) WHERE id = event_id;
  ASSERT lease.trace_id = repeat('a', 32), 'Trace lost across claim';
  ASSERT NOT public.jm_ack_notification(event_id, gen_random_uuid(), true), 'Foreign lease accepted';
  UPDATE notification_private.outbox SET lease_until = now() - interval '1 second' WHERE id = event_id;
  ASSERT NOT public.jm_ack_notification(event_id, lease.lease_token, true), 'Expired lease accepted';
  SELECT * INTO STRICT replacement FROM public.jm_claim_notifications(5) WHERE id = event_id;
  ASSERT replacement.lease_token <> lease.lease_token, 'Reclaimed job needs a new fencing token';
  ASSERT NOT public.jm_ack_notification(event_id, lease.lease_token, false), 'Stale worker changed replacement';
  ASSERT public.jm_ack_notification(event_id, replacement.lease_token, true), 'Current lease could not settle';
  ASSERT NOT public.jm_ack_notification(event_id, replacement.lease_token, true), 'Duplicate acknowledgement accepted';
  ASSERT (SELECT status = 'delivered' AND o.payload = '{}'::jsonb AND length(payload_fingerprint) = 64
    FROM notification_private.outbox o WHERE id = event_id), 'Delivered fixture_payload retention is unsafe';
  ASSERT public.jm_queue_notification('contract-delivered', 'season-start', fixture_payload) = event_id,
    'Delivered event must still deduplicate after removing its private fixture_payload';
  rejected := false;
  BEGIN
    PERFORM public.jm_queue_notification('contract-delivered', 'season-start', fixture_payload || '{"text":"Different message"}');
  EXCEPTION WHEN raise_exception THEN
    rejected := SQLERRM = 'Notification idempotency key collision';
  END;
  ASSERT rejected, 'Same key accepted a different fixture_payload';
  rejected := false;
  BEGIN
    PERFORM public.jm_queue_notification('contract-delivered', 'welcome', fixture_payload);
  EXCEPTION WHEN raise_exception THEN
    rejected := SQLERRM = 'Notification idempotency key collision';
  END;
  ASSERT rejected, 'Same key accepted a different template';

  retry_id := public.jm_queue_notification('contract-retry-event', 'career-milestone', fixture_payload);
  SELECT * INTO STRICT lease FROM public.jm_claim_notifications(5) WHERE id = retry_id;
  ASSERT public.jm_ack_notification(retry_id, lease.lease_token, false, 'Resend HTTP 503');
  ASSERT (SELECT status = 'pending' AND run_after > now() AND attempts = 1
    FROM notification_private.outbox o WHERE id = retry_id), 'Temporary failure did not back off';
  ASSERT NOT EXISTS (SELECT 1 FROM public.jm_claim_notifications(5) WHERE id = retry_id), 'Retried before backoff';
  UPDATE notification_private.outbox SET run_after = now() - interval '1 second' WHERE id = retry_id;
  SELECT * INTO STRICT lease FROM public.jm_claim_notifications(5) WHERE id = retry_id;
  ASSERT public.jm_ack_notification(retry_id, lease.lease_token, false, 'Resend HTTP 422', true);
  ASSERT (SELECT status = 'dead' AND attempts = 2 FROM notification_private.outbox o WHERE id = retry_id),
    'Permanent failure did not become a dead letter';
  ASSERT NOT EXISTS (SELECT 1 FROM public.jm_claim_notifications(5) WHERE id = retry_id), 'Dead letter reclaimed';

  retry_id := public.jm_queue_notification('contract-expired-event', 'welcome', fixture_payload);
  UPDATE notification_private.outbox SET created_at = now() - interval '13 hours' WHERE id = retry_id;
  PERFORM public.jm_reap_notifications();
  ASSERT (SELECT status = 'dead' FROM notification_private.outbox o WHERE id = retry_id), 'Expired delivery window still retries';
END;
$contract$;
RESET ROLE;
ROLLBACK;
