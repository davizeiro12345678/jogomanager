-- Ephemeral room bodies stay in Realtime only. These private receipts retain
-- hashes for admission/retries for 24 hours, not a readable chat history.
CREATE SCHEMA IF NOT EXISTS room_chat_private;
REVOKE ALL ON SCHEMA room_chat_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA room_chat_private TO service_role;

CREATE TABLE room_chat_private.admissions (
  user_id uuid NOT NULL,
  message_id uuid NOT NULL,
  room_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  repeat_fingerprint text CHECK (repeat_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  blocked_rule text CHECK (blocked_rule IN ('profanity','link','contact','shouting','repeated')),
  lease_token uuid,
  lease_until timestamptz,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  PRIMARY KEY (user_id, message_id)
);
ALTER TABLE room_chat_private.admissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON room_chat_private.admissions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON room_chat_private.admissions TO service_role;
CREATE INDEX room_chat_admissions_user_time_idx ON room_chat_private.admissions (user_id, created_at DESC);
CREATE INDEX room_chat_admissions_repeat_idx ON room_chat_private.admissions (user_id, room_id, created_at DESC);
CREATE INDEX room_chat_admissions_retention_idx ON room_chat_private.admissions (created_at);

-- One mutable rate cursor per actor, not one retained row per attempted second.
CREATE TABLE room_chat_private.actor_limits (
  user_id uuid PRIMARY KEY,
  second_bucket bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE room_chat_private.actor_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON room_chat_private.actor_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON room_chat_private.actor_limits TO service_role;
CREATE INDEX room_chat_actor_limits_retention_idx ON room_chat_private.actor_limits(updated_at);

CREATE FUNCTION public.admit_room_chat_message(
  p_user_id uuid, p_room_id uuid, p_message_id uuid,
  p_payload_hash text, p_repeat_fingerprint text, p_moderation_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  v_row room_chat_private.admissions%ROWTYPE;
  v_room public.match_rooms%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_bucket bigint;
  v_count integer;
  v_latest timestamptz;
  v_until timestamptz;
  v_token uuid;
  v_existing boolean;
  v_rule text;
BEGIN
  IF p_user_id IS NULL OR p_room_id IS NULL OR p_message_id IS NULL
    OR p_payload_hash IS NULL OR p_payload_hash !~ '^[0-9a-f]{64}$'
    OR (p_repeat_fingerprint IS NOT NULL AND p_repeat_fingerprint !~ '^[0-9a-f]{64}$')
    OR (p_moderation_reason IS NOT NULL AND p_moderation_reason NOT IN ('profanity','link','contact','shouting'))
  THEN RAISE EXCEPTION 'room_chat_input_invalid' USING ERRCODE = '22023'; END IF;

  -- Serialize all rooms for this actor: one worker cannot race another worker
  -- through membership, moderation, rate limits, repetition or the same receipt.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 64));
  SELECT * INTO v_room FROM public.match_rooms WHERE id = p_room_id FOR SHARE;
  v_now := clock_timestamp();
  IF NOT FOUND OR (v_room.host_id IS DISTINCT FROM p_user_id AND v_room.guest_id IS DISTINCT FROM p_user_id)
    OR v_room.status NOT IN ('open','ready','live','settling')
  THEN RETURN jsonb_build_object('status','room_unavailable'); END IF;

  SELECT * INTO v_row FROM room_chat_private.admissions
    WHERE user_id = p_user_id AND message_id = p_message_id FOR UPDATE;
  v_existing := FOUND;
  IF v_existing THEN
    IF v_row.room_id <> p_room_id OR v_row.payload_hash <> p_payload_hash
    THEN RETURN jsonb_build_object('status','conflict'); END IF;
    IF v_row.created_at < v_now - interval '24 hours'
    THEN RETURN jsonb_build_object('status','expired'); END IF;
    -- Terminal decisions are idempotent too: retrying a rejected intention
    -- must never create another infraction after the second bucket changes.
    IF v_row.blocked_rule IS NOT NULL
    THEN RETURN jsonb_build_object('status','blocked','rule',v_row.blocked_rule); END IF;
    IF v_row.delivered_at IS NOT NULL
    THEN RETURN jsonb_build_object('status','sent','createdAt',v_row.created_at); END IF;
  END IF;

  SELECT count(*), max(created_at) INTO v_count, v_latest FROM public.chat_infractions
    WHERE user_id = p_user_id AND created_at > v_now - interval '7 days';
  v_until := v_latest + CASE WHEN v_count >= 10 THEN interval '30 days'
    WHEN v_count >= 7 THEN interval '7 days' WHEN v_count >= 5 THEN interval '1 day'
    WHEN v_count >= 3 THEN interval '10 minutes' ELSE NULL END;
  IF v_until > v_now THEN RETURN jsonb_build_object('status','muted','until',v_until); END IF;

  IF v_existing THEN
    IF v_row.lease_until > v_now THEN RETURN jsonb_build_object('status','pending'); END IF;
    IF v_row.attempts >= 3 THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  ELSE
    v_bucket := floor(extract(epoch FROM v_now));
    INSERT INTO room_chat_private.actor_limits AS limits(user_id, second_bucket, updated_at)
      VALUES(p_user_id, v_bucket, v_now)
      ON CONFLICT(user_id) DO UPDATE SET second_bucket=excluded.second_bucket, updated_at=v_now
      WHERE limits.second_bucket < excluded.second_bucket;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN RETURN jsonb_build_object('status','rate_limited'); END IF;
    IF (SELECT count(*) FROM room_chat_private.admissions WHERE user_id = p_user_id
      AND created_at >= v_now - interval '1 minute') >= 20
      OR (SELECT count(*) FROM room_chat_private.admissions WHERE user_id = p_user_id
      AND created_at >= v_now - interval '1 hour') >= 200
    THEN RETURN jsonb_build_object('status','rate_limited'); END IF;

    v_rule := p_moderation_reason;
    IF v_rule IS NULL AND p_repeat_fingerprint IS NOT NULL AND EXISTS (
      SELECT 1 FROM (SELECT repeat_fingerprint FROM room_chat_private.admissions
        WHERE user_id = p_user_id AND room_id = p_room_id AND blocked_rule IS NULL
          AND created_at >= v_now - interval '24 hours'
        ORDER BY created_at DESC, message_id DESC LIMIT 3) recent
        WHERE recent.repeat_fingerprint = p_repeat_fingerprint
    ) THEN v_rule := 'repeated'; END IF;

    INSERT INTO room_chat_private.admissions(user_id,message_id,room_id,payload_hash,repeat_fingerprint,created_at,blocked_rule)
      VALUES(p_user_id,p_message_id,p_room_id,p_payload_hash,p_repeat_fingerprint,v_now,v_rule)
      RETURNING * INTO v_row;
    IF v_rule IS NOT NULL THEN
      INSERT INTO public.chat_infractions(user_id, reason) VALUES(p_user_id, v_rule);
      RETURN jsonb_build_object('status','blocked','rule',v_rule);
    END IF;
  END IF;

  v_token := gen_random_uuid();
  UPDATE room_chat_private.admissions SET lease_token = v_token,
    lease_until = v_now + interval '30 seconds', attempts = attempts + 1
    WHERE user_id = p_user_id AND message_id = p_message_id;
  RETURN jsonb_build_object('status','leased','leaseToken',v_token,'createdAt',v_row.created_at);
END;
$function$;
REVOKE ALL ON FUNCTION public.admit_room_chat_message(uuid,uuid,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admit_room_chat_message(uuid,uuid,uuid,text,text,text) TO service_role;

CREATE FUNCTION public.finish_room_chat_message(
  p_user_id uuid, p_message_id uuid, p_lease_token uuid, p_delivered boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE v_count integer;
BEGIN
  UPDATE room_chat_private.admissions SET
    delivered_at = CASE WHEN p_delivered THEN now() ELSE NULL END,
    lease_token = NULL,
    lease_until = CASE WHEN p_delivered THEN NULL ELSE now() + interval '2 seconds' END
    WHERE user_id = p_user_id AND message_id = p_message_id
      AND lease_token = p_lease_token AND delivered_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$function$;
REVOKE ALL ON FUNCTION public.finish_room_chat_message(uuid,uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_room_chat_message(uuid,uuid,uuid,boolean) TO service_role;

CREATE FUNCTION public.prune_room_chat_receipts(p_limit integer DEFAULT 1000)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE v_count integer; v_other integer; v_limits integer;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'invalid_prune_limit'; END IF;
  DELETE FROM room_chat_private.admissions WHERE (user_id,message_id) IN (
    SELECT user_id,message_id FROM room_chat_private.admissions
      WHERE created_at < now() - interval '24 hours' ORDER BY created_at LIMIT p_limit);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM public.room_chat_rate_limits WHERE (user_id,second_bucket) IN (
    SELECT user_id,second_bucket FROM public.room_chat_rate_limits
      WHERE second_bucket < floor(extract(epoch FROM now() - interval '2 minutes'))
      ORDER BY second_bucket LIMIT p_limit);
  GET DIAGNOSTICS v_other = ROW_COUNT;
  DELETE FROM room_chat_private.actor_limits WHERE user_id IN (
    SELECT user_id FROM room_chat_private.actor_limits
      WHERE updated_at < now() - interval '24 hours' ORDER BY updated_at LIMIT p_limit);
  GET DIAGNOSTICS v_limits = ROW_COUNT;
  RETURN v_count + v_other + v_limits;
END;
$function$;
REVOKE ALL ON FUNCTION public.prune_room_chat_receipts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_room_chat_receipts(integer) TO service_role;

DO $schedule$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('jm_room_chat_receipts_prune','*/5 * * * *',
      'SELECT public.prune_room_chat_receipts(1000)');
  END IF;
END $schedule$;
