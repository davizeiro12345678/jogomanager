-- Internal-only tables: no client access at all
REVOKE ALL ON public.club_external_ids FROM anon, authenticated;
REVOKE ALL ON public.import_runs FROM anon, authenticated;
GRANT ALL ON public.club_external_ids TO service_role;
GRANT ALL ON public.import_runs TO service_role;

-- Chat: anon has no policies, remove leftover grants
REVOKE ALL ON public.chat_messages FROM anon;
GRANT SELECT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

-- Wallet: read-only for the owner, nothing for anon
REVOKE ALL ON public.user_wallet FROM anon, authenticated;
GRANT SELECT ON public.user_wallet TO authenticated;
GRANT ALL ON public.user_wallet TO service_role;

-- SECURITY DEFINER functions: not callable by anonymous visitors
REVOKE EXECUTE ON FUNCTION public.send_chat_message(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spend_coins(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_coins(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Chat display name must never leak the e-mail address
CREATE OR REPLACE FUNCTION public.send_chat_message(message_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  clean_body text;
  sender_name text;
  new_id uuid;
  recent_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  clean_body := btrim(COALESCE(message_body, ''));
  IF char_length(clean_body) < 1 OR char_length(clean_body) > 500 THEN
    RAISE EXCEPTION 'invalid_length';
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.chat_messages m
  WHERE m.user_id = auth.uid()
    AND m.created_at > now() - interval '1 minute';
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  -- Nunca usar o e-mail: apenas apelido escolhido pelo usuário ou nome genérico.
  SELECT COALESCE(
      NULLIF(btrim(u.raw_user_meta_data->>'display_name'), ''),
      'Técnico ' || substr(replace(u.id::text, '-', ''), 1, 5)
    )
  INTO sender_name
  FROM auth.users u
  WHERE u.id = auth.uid();

  INSERT INTO public.chat_messages (user_id, display_name, body)
  VALUES (auth.uid(), left(COALESCE(sender_name, 'Técnico'), 40), clean_body)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_chat_message(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message(text) TO authenticated;