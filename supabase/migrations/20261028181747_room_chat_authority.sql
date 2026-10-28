-- Room messages are inserted only through the authenticated application server.
CREATE TABLE public.match_room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.match_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX match_room_messages_room_time_idx
  ON public.match_room_messages (room_id, created_at DESC, id DESC);
CREATE TABLE public.match_room_chat_limits (
  sender_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  message_count integer NOT NULL CHECK (message_count BETWEEN 1 AND 10)
);
ALTER TABLE public.match_room_chat_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_room_chat_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.match_room_chat_limits TO service_role;

-- Limit semantic moderation requests before calling the external provider.
CREATE TABLE public.chat_moderation_limits (
  sender_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL CHECK (attempt_count BETWEEN 1 AND 20)
);
ALTER TABLE public.chat_moderation_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_moderation_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.chat_moderation_limits TO service_role;

ALTER TABLE public.match_room_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_room_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.match_room_messages TO authenticated;
GRANT ALL ON public.match_room_messages TO service_role;
CREATE POLICY "Room participants read messages" ON public.match_room_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.match_rooms r
      WHERE r.id = match_room_messages.room_id
        AND ((SELECT auth.uid()) = r.host_id OR (SELECT auth.uid()) = r.guest_id)
    )
  );

CREATE FUNCTION public.reserve_chat_moderation_for(_user_id uuid, _room_id uuid DEFAULT NULL)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  allowed boolean;
  recent text[];
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_participant'; END IF;
  IF _room_id IS NOT NULL THEN
    PERFORM 1 FROM public.match_rooms r
      WHERE r.id = _room_id AND r.status IN ('open', 'ready', 'live', 'settling')
        AND (_user_id = r.host_id OR _user_id = r.guest_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'not_participant'; END IF;
  END IF;
  INSERT INTO public.chat_moderation_limits AS limits (sender_id, window_started_at, attempt_count)
  VALUES (_user_id, now(), 1)
  ON CONFLICT (sender_id) DO UPDATE SET
    window_started_at = CASE WHEN limits.window_started_at < now() - interval '1 minute'
      THEN now() ELSE limits.window_started_at END,
    attempt_count = CASE WHEN limits.window_started_at < now() - interval '1 minute'
      THEN 1 ELSE limits.attempt_count + 1 END
  WHERE limits.window_started_at < now() - interval '1 minute' OR limits.attempt_count < 20
  RETURNING true INTO allowed;
  IF NOT COALESCE(allowed, false) THEN RAISE EXCEPTION 'rate_limited'; END IF;
  IF _room_id IS NULL THEN RETURN ARRAY[]::text[]; END IF;
  SELECT COALESCE(pg_catalog.array_agg(m.body ORDER BY m.created_at, m.id), ARRAY[]::text[])
    INTO recent FROM (
      SELECT body, created_at, id FROM public.match_room_messages
      WHERE room_id = _room_id ORDER BY created_at DESC, id DESC LIMIT 3
    ) m;
  RETURN recent;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_chat_moderation_for(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_chat_moderation_for(uuid, uuid) TO service_role;

CREATE FUNCTION public.send_match_room_message_for(_room_id uuid, _user_id uuid, _body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  clean_body text := pg_catalog.btrim(COALESCE(_body, ''));
  inserted_id uuid;
  allowed boolean;
BEGIN
  IF _room_id IS NULL OR _user_id IS NULL THEN RAISE EXCEPTION 'not_participant'; END IF;
  IF pg_catalog.char_length(clean_body) < 1 OR pg_catalog.char_length(clean_body) > 200 THEN
    RAISE EXCEPTION 'invalid_length';
  END IF;

  -- A SHARE lock serializes a send with the room closing and its cleanup.
  PERFORM 1 FROM public.match_rooms r
    WHERE r.id = _room_id AND r.status IN ('open', 'ready', 'live', 'settling')
      AND (_user_id = r.host_id OR _user_id = r.guest_id)
    FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_participant'; END IF;

  -- Atomic per-account window persists even if a user closes their room.
  INSERT INTO public.match_room_chat_limits AS limits (sender_id, window_started_at, message_count)
  VALUES (_user_id, now(), 1)
  ON CONFLICT (sender_id) DO UPDATE SET
    window_started_at = CASE WHEN limits.window_started_at < now() - interval '1 minute'
      THEN now() ELSE limits.window_started_at END,
    message_count = CASE WHEN limits.window_started_at < now() - interval '1 minute'
      THEN 1 ELSE limits.message_count + 1 END
  WHERE limits.window_started_at < now() - interval '1 minute' OR limits.message_count < 10
  RETURNING true INTO allowed;
  IF NOT COALESCE(allowed, false) THEN RAISE EXCEPTION 'rate_limited'; END IF;
  INSERT INTO public.match_room_messages (room_id, sender_id, body)
    VALUES (_room_id, _user_id, clean_body) RETURNING id INTO inserted_id;
  RETURN inserted_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_match_room_message_for(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_match_room_message_for(uuid, uuid, text) TO service_role;

CREATE FUNCTION public.clear_match_room_messages_on_close()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.match_room_messages WHERE room_id = NEW.id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_match_room_messages_on_close() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_match_room_messages_on_close() TO service_role;
CREATE TRIGGER clear_match_room_messages_on_close
  AFTER UPDATE OF status ON public.match_rooms FOR EACH ROW
  WHEN (NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done')
  EXECUTE FUNCTION public.clear_match_room_messages_on_close();

ALTER PUBLICATION supabase_realtime ADD TABLE public.match_room_messages;
