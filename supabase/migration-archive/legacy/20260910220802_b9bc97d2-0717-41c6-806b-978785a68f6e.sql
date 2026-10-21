DROP FUNCTION IF EXISTS public.send_chat_message(text);
DROP FUNCTION IF EXISTS public.spend_coins(integer);

CREATE OR REPLACE FUNCTION public.send_chat_message_for(_user_id uuid, message_body text)
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
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  clean_body := btrim(COALESCE(message_body, ''));
  IF char_length(clean_body) < 1 OR char_length(clean_body) > 500 THEN
    RAISE EXCEPTION 'invalid_length';
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.chat_messages m
  WHERE m.user_id = _user_id
    AND m.created_at > now() - interval '1 minute';
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT COALESCE(
      NULLIF(btrim(u.raw_user_meta_data->>'display_name'), ''),
      'Técnico ' || substr(replace(u.id::text, '-', ''), 1, 5)
    )
  INTO sender_name
  FROM auth.users u
  WHERE u.id = _user_id;

  IF sender_name IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.chat_messages (user_id, display_name, body)
  VALUES (_user_id, left(sender_name, 40), clean_body)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.spend_coins_for(_user_id uuid, amount integer)
 RETURNS TABLE(coins integer, season_pass boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_coins integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF amount IS NULL OR amount <= 0 OR amount > 1000000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  INSERT INTO public.user_wallet (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT w.coins INTO current_coins
  FROM public.user_wallet w
  WHERE w.user_id = _user_id
  FOR UPDATE;

  IF current_coins < amount THEN
    RETURN;
  END IF;

  UPDATE public.user_wallet w
  SET coins = w.coins - amount, updated_at = now()
  WHERE w.user_id = _user_id;

  RETURN QUERY
  SELECT w.coins, w.season_pass FROM public.user_wallet w WHERE w.user_id = _user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_chat_message_for(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spend_coins_for(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message_for(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.spend_coins_for(uuid, integer) TO service_role;