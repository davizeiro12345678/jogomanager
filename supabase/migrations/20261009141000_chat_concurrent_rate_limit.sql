-- PREPARED ONLY. Serialize senders before checking and inserting messages,
-- so concurrent requests cannot all pass the same ten-messages/minute check.
CREATE OR REPLACE FUNCTION public.send_chat_message_for(_user_id uuid, message_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE clean_body text; sender_name text; new_id uuid; recent_count integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  clean_body := btrim(regexp_replace(COALESCE(message_body, ''), '[[:cntrl:]]', '', 'g'));
  IF char_length(clean_body) < 1 OR char_length(clean_body) > 500 THEN RAISE EXCEPTION 'invalid_length'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('chat-sender:' || _user_id::text, 0));
  SELECT count(*) INTO recent_count FROM public.chat_messages m
  WHERE m.user_id = _user_id AND m.created_at > now() - interval '1 minute';
  IF recent_count >= 10 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  SELECT COALESCE(NULLIF(btrim(regexp_replace(u.raw_user_meta_data->>'display_name', '[[:cntrl:]]', '', 'g')), ''),
    'Técnico ' || substr(replace(u.id::text, '-', ''), 1, 5))
  INTO sender_name FROM auth.users u WHERE u.id = _user_id;
  IF sender_name IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.chat_messages(user_id, display_name, body)
  VALUES (_user_id, left(sender_name, 40), clean_body) RETURNING id INTO new_id;
  RETURN new_id;
END; $$;
CREATE INDEX IF NOT EXISTS chat_messages_sender_created_idx ON public.chat_messages(user_id, created_at DESC);
REVOKE ALL ON FUNCTION public.send_chat_message_for(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message_for(uuid, text) TO service_role;
REVOKE INSERT, UPDATE ON public.chat_messages FROM anon, authenticated;
