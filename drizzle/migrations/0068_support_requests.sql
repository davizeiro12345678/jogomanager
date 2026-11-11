-- Support outbox: only authenticated server functions derive the actor and recipient.
CREATE SCHEMA IF NOT EXISTS support_private;
REVOKE ALL ON SCHEMA support_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA support_private TO service_role;

CREATE TABLE support_private.requests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 16384),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  lease_token uuid,
  lease_until timestamptz,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  delivered_at timestamptz,
  PRIMARY KEY (user_id, request_id)
);
ALTER TABLE support_private.requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON support_private.requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON support_private.requests TO service_role;
CREATE INDEX support_requests_user_created_idx ON support_private.requests (user_id, created_at DESC);
CREATE INDEX support_requests_retention_idx ON support_private.requests (created_at);

CREATE FUNCTION public.reserve_support_request(
  p_user_id uuid, p_request_id uuid, p_payload_hash text, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  v_row support_private.requests%ROWTYPE;
  v_token uuid;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_payload_hash IS NULL
    OR p_payload_hash !~ '^[0-9a-f]{64}$' OR p_payload IS NULL
    OR jsonb_typeof(p_payload) <> 'object' OR octet_length(p_payload::text) > 16384
    OR p_payload - ARRAY['email', 'category', 'message'] <> '{}'::jsonb
    OR jsonb_typeof(p_payload->'email') IS DISTINCT FROM 'string'
    OR char_length(p_payload->>'email') NOT BETWEEN 3 AND 254
    OR jsonb_typeof(p_payload->'category') IS DISTINCT FROM 'string'
    OR p_payload->>'category' NOT IN ('career','purchase','account','bug','suggestion')
    OR jsonb_typeof(p_payload->'message') IS DISTINCT FROM 'string'
    OR char_length(btrim(p_payload->>'message')) NOT BETWEEN 20 AND 4000
  THEN RAISE EXCEPTION 'support_input_invalid' USING ERRCODE = '22023'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 63));
  -- Bound opportunistic retention work; deployments must also schedule the documented daily prune.
  DELETE FROM support_private.requests WHERE (user_id, request_id) IN (
    SELECT user_id, request_id FROM support_private.requests
    WHERE created_at < now() - interval '30 days' ORDER BY created_at LIMIT 100
  );
  SELECT * INTO v_row FROM support_private.requests
    WHERE user_id = p_user_id AND request_id = p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_row.payload_hash <> p_payload_hash THEN RETURN jsonb_build_object('status', 'conflict'); END IF;
    IF v_row.status = 'sent' THEN RETURN jsonb_build_object('status', 'sent'); END IF;
    IF v_row.lease_until > now() THEN RETURN jsonb_build_object('status', 'pending'); END IF;
    IF v_row.attempts >= 3 THEN RETURN jsonb_build_object('status', 'unavailable'); END IF;
  ELSE
    IF (SELECT count(*) FROM support_private.requests
      WHERE user_id = p_user_id AND created_at >= now() - interval '1 hour') >= 3
    THEN RETURN jsonb_build_object('status', 'rate_limited'); END IF;
    INSERT INTO support_private.requests (user_id, request_id, payload_hash, payload)
      VALUES (p_user_id, p_request_id, p_payload_hash, p_payload)
      RETURNING * INTO v_row;
  END IF;

  v_token := gen_random_uuid();
  UPDATE support_private.requests SET lease_token = v_token,
    lease_until = now() + interval '30 seconds', attempts = attempts + 1, status = 'queued'
    WHERE user_id = p_user_id AND request_id = p_request_id;
  RETURN jsonb_build_object('status', 'leased', 'leaseToken', v_token,
    'createdAt', v_row.created_at, 'payload', v_row.payload);
END;
$function$;
REVOKE ALL ON FUNCTION public.reserve_support_request(uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_support_request(uuid,uuid,text,jsonb) TO service_role;

CREATE FUNCTION public.finish_support_request(
  p_user_id uuid, p_request_id uuid, p_lease_token uuid, p_delivered boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE v_count integer;
BEGIN
  UPDATE support_private.requests SET
    status = CASE WHEN p_delivered THEN 'sent' ELSE 'failed' END,
    delivered_at = CASE WHEN p_delivered THEN now() ELSE NULL END,
    lease_token = NULL,
    lease_until = CASE WHEN p_delivered THEN NULL ELSE now() + interval '30 seconds' END
    WHERE user_id = p_user_id AND request_id = p_request_id
      AND lease_token = p_lease_token AND status <> 'sent';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$function$;
REVOKE ALL ON FUNCTION public.finish_support_request(uuid,uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_support_request(uuid,uuid,uuid,boolean) TO service_role;
COMMENT ON TABLE support_private.requests IS 'Private support delivery outbox. No browser grants. Daily retention: delete entries older than 30 days. Delete account cascades.';
