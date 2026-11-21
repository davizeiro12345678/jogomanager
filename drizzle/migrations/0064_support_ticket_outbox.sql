-- Personal support data is accessible only to authenticated application servers.
-- Browsers never receive a grant to tickets, delivery leases or reply addresses.
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 320),
  category text NOT NULL CHECK (category IN ('gameplay', 'account', 'purchase', 'privacy', 'report')),
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 5 AND 120),
  message text NOT NULL CHECK (length(btrim(message)) BETWEEN 20 AND 4000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  delivered_at timestamptz,
  UNIQUE (user_id, request_id)
);
CREATE INDEX support_tickets_user_created_idx ON public.support_tickets(user_id, created_at DESC);

CREATE TABLE public.support_delivery_outbox (
  ticket_id uuid PRIMARY KEY REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text CHECK (length(last_error_code) <= 80),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX support_outbox_due_idx ON public.support_delivery_outbox(next_attempt_at)
  WHERE status IN ('pending', 'processing') AND attempts < 5;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_delivery_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_tickets, public.support_delivery_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.support_tickets, public.support_delivery_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_user_id uuid, p_email text, p_request_id uuid,
  p_category text, p_subject text, p_message text
)
RETURNS TABLE(ticket_id uuid, status text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_now timestamptz;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'support requires service role' USING ERRCODE = '28000';
  END IF;
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_email IS NULL
     OR length(p_email) NOT BETWEEN 3 AND 320 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR p_category IS NULL OR p_category NOT IN ('gameplay', 'account', 'purchase', 'privacy', 'report')
     OR p_subject IS NULL OR length(btrim(p_subject)) NOT BETWEEN 5 AND 120
     OR p_message IS NULL OR length(btrim(p_message)) NOT BETWEEN 20 AND 4000 THEN
    RAISE EXCEPTION 'invalid support request' USING ERRCODE = '23514';
  END IF;
  -- Serialize this account across servers before the idempotency and quota checks.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('support:' || p_user_id::text, 0));
  -- A captured value is an indexable range bound; clock_timestamp() per row is volatile.
  v_now := pg_catalog.clock_timestamp();
  SELECT * INTO v_ticket FROM public.support_tickets AS t
    WHERE t.user_id = p_user_id AND t.request_id = p_request_id;
  IF FOUND THEN
    IF v_ticket.email IS DISTINCT FROM lower(p_email) OR v_ticket.category IS DISTINCT FROM p_category
       OR v_ticket.subject IS DISTINCT FROM btrim(p_subject) OR v_ticket.message IS DISTINCT FROM btrim(p_message) THEN
      RAISE EXCEPTION 'support_request_mismatch' USING ERRCODE = '23514';
    END IF;
    RETURN QUERY SELECT v_ticket.id, CASE
      WHEN v_ticket.delivered_at IS NOT NULL THEN 'delivered'
      WHEN EXISTS (SELECT 1 FROM public.support_delivery_outbox AS o WHERE o.ticket_id = v_ticket.id
        AND (o.status = 'failed' OR (o.status = 'processing' AND o.attempts >= 5
          AND o.lease_expires_at <= pg_catalog.clock_timestamp()))) THEN 'delivery_failed'
      ELSE 'queued' END::text;
    RETURN;
  END IF;
  IF (SELECT count(*) FROM (SELECT 1 FROM public.support_tickets AS t WHERE t.user_id = p_user_id
      AND t.created_at >= v_now - interval '1 hour' LIMIT 3) AS recent) >= 3 THEN
    RAISE EXCEPTION 'support_rate_limited' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.support_tickets(user_id, request_id, email, category, subject, message)
    VALUES (p_user_id, p_request_id, lower(p_email), p_category, btrim(p_subject), btrim(p_message))
    RETURNING * INTO v_ticket;
  INSERT INTO public.support_delivery_outbox(ticket_id) VALUES(v_ticket.id);
  RETURN QUERY SELECT v_ticket.id, 'queued'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_support_deliveries(p_limit integer DEFAULT 3, p_ticket_id uuid DEFAULT NULL)
RETURNS TABLE(ticket_id uuid, user_id uuid, email text, category text, subject text, message text,
  created_at timestamptz, lease_token uuid, attempts integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'support requires service role' USING ERRCODE = '28000';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'invalid support dispatch limit' USING ERRCODE = '23514';
  END IF;
  WITH exhausted AS (
    SELECT o.ticket_id FROM public.support_delivery_outbox AS o
    WHERE o.status = 'processing' AND o.attempts >= 5 AND o.lease_expires_at <= pg_catalog.clock_timestamp()
      AND (p_ticket_id IS NULL OR o.ticket_id = p_ticket_id)
    ORDER BY o.lease_expires_at LIMIT p_limit FOR UPDATE SKIP LOCKED
  )
  UPDATE public.support_delivery_outbox AS o SET status = 'failed', lease_token = NULL,
    lease_expires_at = NULL, last_error_code = 'lease_expired_after_max_attempts', updated_at = pg_catalog.clock_timestamp()
    FROM exhausted WHERE o.ticket_id = exhausted.ticket_id;
  RETURN QUERY
    WITH due AS (
      SELECT o.ticket_id FROM public.support_delivery_outbox AS o
      WHERE o.attempts < 5 AND (p_ticket_id IS NULL OR o.ticket_id = p_ticket_id)
        AND ((o.status = 'pending' AND o.next_attempt_at <= pg_catalog.clock_timestamp())
          OR (o.status = 'processing' AND o.lease_expires_at <= pg_catalog.clock_timestamp()))
      ORDER BY o.next_attempt_at, o.ticket_id
      LIMIT p_limit FOR UPDATE SKIP LOCKED
    ), claimed AS (
      UPDATE public.support_delivery_outbox AS o SET status = 'processing', attempts = o.attempts + 1,
        lease_token = pg_catalog.gen_random_uuid(), lease_expires_at = pg_catalog.clock_timestamp() + interval '30 seconds',
        updated_at = pg_catalog.clock_timestamp()
      FROM due WHERE o.ticket_id = due.ticket_id
      RETURNING o.ticket_id, o.lease_token, o.attempts
    )
    SELECT t.id, t.user_id, t.email, t.category, t.subject, t.message, t.created_at, c.lease_token, c.attempts
    FROM claimed AS c JOIN public.support_tickets AS t ON t.id = c.ticket_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_support_delivery(
  p_ticket_id uuid, p_lease_token uuid, p_delivered boolean,
  p_error_code text DEFAULT '', p_retryable boolean DEFAULT true
)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_updated uuid;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'support requires service role' USING ERRCODE = '28000';
  END IF;
  IF p_delivered IS NULL OR p_retryable IS NULL OR p_error_code IS NULL
    OR length(p_error_code) > 80 OR p_error_code !~ '^[a-z0-9_]*$' THEN
    RAISE EXCEPTION 'invalid support acknowledgement' USING ERRCODE = '23514';
  END IF;
  UPDATE public.support_delivery_outbox AS o SET
    status = CASE WHEN p_delivered THEN 'delivered' WHEN p_retryable AND o.attempts < 5 THEN 'pending' ELSE 'failed' END,
    next_attempt_at = pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => least(3600, 30 * power(2, o.attempts - 1))::double precision),
    lease_token = NULL, lease_expires_at = NULL,
    last_error_code = CASE WHEN p_delivered THEN NULL ELSE p_error_code END,
    updated_at = pg_catalog.clock_timestamp()
    WHERE o.ticket_id = p_ticket_id AND o.lease_token = p_lease_token AND o.status = 'processing'
      AND o.lease_expires_at > pg_catalog.clock_timestamp()
    RETURNING o.ticket_id INTO v_updated;
  IF v_updated IS NULL THEN RETURN false; END IF;
  IF p_delivered THEN
    UPDATE public.support_tickets AS t SET delivered_at = pg_catalog.clock_timestamp() WHERE t.id = v_updated;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_support_ticket(uuid, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_support_deliveries(integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_support_delivery(uuid, uuid, boolean, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(uuid, text, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_support_deliveries(integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_support_delivery(uuid, uuid, boolean, text, boolean) TO service_role;

COMMENT ON TABLE public.support_tickets IS 'Private verified-account support requests. Idempotent per account/request; at most three new requests per hour.';
COMMENT ON TABLE public.support_delivery_outbox IS 'Server-only leased delivery with five attempts. Receivers deduplicate the stable ticket ID before side effects.';
NOTIFY pgrst, 'reload schema';
