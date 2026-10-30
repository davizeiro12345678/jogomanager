-- Durable, private transactional notification outbox. Not activated until
-- the Node worker is deployed with service-only secrets and release gates pass.
-- Only non-auth transactional notifications may be queued.
CREATE SCHEMA IF NOT EXISTS notification_private;
REVOKE ALL ON SCHEMA notification_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA notification_private TO service_role;

CREATE TABLE IF NOT EXISTS notification_private.outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE CHECK (length(dedupe_key) BETWEEN 12 AND 128),
  template text NOT NULL CHECK (template IN ('welcome', 'season-start', 'career-milestone')),
  payload jsonb NOT NULL,
  payload_fingerprint text NOT NULL CHECK (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  trace_id text CHECK (trace_id IS NULL OR trace_id ~ '^[0-9a-f]{32}$'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'delivered', 'dead')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  lease_token uuid,
  lease_until timestamptz,
  run_after timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_error text,
  CHECK (octet_length(payload::text) <= 160000)
);
CREATE INDEX IF NOT EXISTS jm_notifications_due_idx
  ON notification_private.outbox (run_after, created_at)
  WHERE status IN ('pending', 'processing');
ALTER TABLE notification_private.outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON notification_private.outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_private.outbox TO service_role;

-- The REST-facing functions are intentionally service-role-only.
-- Calling users never get access to recipients, email bodies or the queue.
CREATE OR REPLACE FUNCTION public.jm_queue_notification(
  p_key text, p_template text, p_payload jsonb, p_trace_id text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE v_id uuid; v_existing text; v_fingerprint text;
BEGIN
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 12 AND 128
    OR p_template NOT IN ('welcome', 'season-start', 'career-milestone')
    OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
    OR octet_length(p_payload::text) > 160000
    OR length(coalesce(p_payload->>'to', '')) NOT BETWEEN 3 AND 254
    OR position('@' IN coalesce(p_payload->>'to','')) < 2
    OR length(coalesce(p_payload->>'from','')) NOT BETWEEN 3 AND 254
    OR length(coalesce(p_payload->>'subject','')) NOT BETWEEN 1 AND 300
    OR length(coalesce(p_payload->>'html','')) NOT BETWEEN 1 AND 120000
    OR length(coalesce(p_payload->>'text','')) NOT BETWEEN 1 AND 40000
    OR (p_trace_id IS NOT NULL AND p_trace_id !~ '^[0-9a-f]{32}$')
  THEN RAISE EXCEPTION 'Invalid notification request'; END IF;
  v_fingerprint := encode(sha256(convert_to(p_payload::text, 'UTF8')), 'hex');
  INSERT INTO notification_private.outbox (dedupe_key, template, payload, payload_fingerprint, trace_id)
  VALUES (p_key, p_template, p_payload, v_fingerprint, p_trace_id)
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT id, payload_fingerprint INTO v_id, v_existing
    FROM notification_private.outbox WHERE dedupe_key = p_key;
  IF v_existing IS DISTINCT FROM v_fingerprint THEN
    RAISE EXCEPTION 'Notification idempotency key collision';
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.jm_queue_notification(text,text,jsonb,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jm_queue_notification(text,text,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.jm_claim_notifications(p_limit integer DEFAULT 5)
RETURNS TABLE(id uuid, dedupe_key text, payload jsonb, trace_id text, lease_token uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Invalid batch size';
  END IF;
  -- Expired processing leases are reclaimed; exhausted jobs become dead letters.
  UPDATE notification_private.outbox o
  SET status = 'dead', lease_token = NULL, lease_until = NULL,
      updated_at = now(), last_error = 'attempts exhausted'
  WHERE o.status = 'processing' AND o.lease_until < now() AND o.attempts >= 8;

  RETURN QUERY
    WITH candidates AS (
      SELECT o.id FROM notification_private.outbox o
      WHERE (o.status = 'pending' AND o.run_after <= now())
         OR (o.status = 'processing' AND o.lease_until < now() AND o.attempts < 8)
      ORDER BY o.run_after, o.created_at
      FOR UPDATE SKIP LOCKED LIMIT p_limit
    )
    UPDATE notification_private.outbox o
    SET status='processing', attempts=o.attempts+1,
        lease_token=gen_random_uuid(), lease_until=now()+interval '90 seconds',
        updated_at=now()
    FROM candidates c WHERE o.id=c.id
    RETURNING o.id, o.dedupe_key, o.payload, o.trace_id, o.lease_token;
END $$;
REVOKE ALL ON FUNCTION public.jm_claim_notifications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jm_claim_notifications(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.jm_ack_notification(
  p_id uuid, p_lease_token uuid, p_success boolean, p_error text DEFAULT NULL, p_terminal boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE v_changed integer;
BEGIN
  IF p_success IS NULL OR p_id IS NULL OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Invalid acknowledgement';
  END IF;
  UPDATE notification_private.outbox o
  SET status = CASE WHEN p_success THEN 'delivered'
                  WHEN o.attempts >= 8 OR p_terminal THEN 'dead' ELSE 'pending' END,
      completed_at = CASE WHEN p_success THEN now() ELSE NULL END,
      lease_until = NULL, lease_token = NULL,
      run_after = CASE WHEN p_success THEN o.run_after ELSE
        now() + make_interval(secs => LEAST(3600, 5 * power(2, LEAST(o.attempts, 8)))::int) END,
      last_error = CASE WHEN p_success THEN NULL
        ELSE left(coalesce(p_error, 'temporary_delivery_failure'), 180) END,
      updated_at = now(),
      -- Remove content after successful delivery to minimize private retention.
      payload = CASE WHEN p_success THEN '{}'::jsonb ELSE o.payload END
  WHERE o.id=p_id AND o.lease_token=p_lease_token AND o.status='processing'
    AND o.lease_until >= now();
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed=1;
END $$;
REVOKE ALL ON FUNCTION public.jm_ack_notification(uuid,uuid,boolean,text,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jm_ack_notification(uuid,uuid,boolean,text,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.jm_reap_notifications()
RETURNS TABLE(expired integer, removed integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  -- Stop retrying ambiguous submissions after the provider's short
  -- idempotency retention window. Reduces duplicate-send risk.
  UPDATE notification_private.outbox
  SET status='dead', lease_token=NULL, lease_until=NULL, last_error='delivery window expired'
  WHERE status IN ('pending','processing') AND created_at < now()-interval '12 hours';
  GET DIAGNOSTICS expired=ROW_COUNT;
  DELETE FROM notification_private.outbox
  WHERE (status='delivered' AND completed_at < now()-interval '7 days')
     OR (status='dead' AND updated_at < now()-interval '14 days');
  GET DIAGNOSTICS removed=ROW_COUNT;
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.jm_reap_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jm_reap_notifications() TO service_role;
