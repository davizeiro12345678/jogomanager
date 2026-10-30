-- Disposable replay database only: every fixture is rolled back.
BEGIN;
SET LOCAL statement_timeout = '10s';

DO $access$
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.jm_ack_notification(uuid,uuid,boolean,text,boolean)', 'EXECUTE');
  ASSERT NOT has_function_privilege('authenticated', 'public.jm_ack_notification(uuid,uuid,boolean,text,boolean)', 'EXECUTE');
  ASSERT has_function_privilege('service_role', 'public.jm_ack_notification(uuid,uuid,boolean,text,boolean)', 'EXECUTE');
  ASSERT NOT has_table_privilege('authenticated', 'notification_private.outbox', 'SELECT');
END;
$access$;

SET LOCAL ROLE service_role;
DO $queue$
DECLARE
  job_id uuid;
  lease uuid;
  payload jsonb := '{"to":"qa@example.test","from":"sender@example.test","subject":"Season","html":"<p>Ready</p>","text":"Ready"}';
BEGIN
  job_id := public.jm_queue_notification(repeat('a',64), 'season-start', payload);
  ASSERT public.jm_queue_notification(repeat('a',64), 'season-start', payload) = job_id;
  SELECT lease_token INTO lease FROM public.jm_claim_notifications(1) WHERE id = job_id;
  ASSERT lease IS NOT NULL, 'The pending notification was not claimed';
  ASSERT NOT public.jm_ack_notification(job_id, gen_random_uuid(), true), 'A stale lease acknowledged delivery';
  ASSERT public.jm_ack_notification(job_id, lease, true), 'The owned lease failed acknowledgement';
  ASSERT (SELECT o.payload = '{}'::jsonb FROM notification_private.outbox o WHERE o.id = job_id), 'Delivered content was retained';
  ASSERT public.jm_queue_notification(repeat('a',64), 'season-start', payload) = job_id,
    'Idempotency must survive successful content deletion';
  BEGIN
    PERFORM public.jm_queue_notification(repeat('a',64), 'season-start', payload || '{"subject":"Changed"}'::jsonb);
    RAISE EXCEPTION 'Expected a key collision';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%idempotency key collision%', 'A changed payload was not rejected as a collision';
  END;
END;
$queue$;
RESET ROLE;
ROLLBACK;
