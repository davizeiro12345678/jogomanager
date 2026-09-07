
-- ============ 1. Carteira: somente leitura para o usuário ============
DROP POLICY IF EXISTS "Users manage own wallet" ON public.user_wallet;
REVOKE INSERT, UPDATE, DELETE ON public.user_wallet FROM authenticated;
REVOKE ALL ON public.user_wallet FROM anon;
GRANT SELECT ON public.user_wallet TO authenticated;

CREATE POLICY "Users read own wallet" ON public.user_wallet
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Débito seguro de moedas, feito no servidor com verificação de saldo.
CREATE OR REPLACE FUNCTION public.spend_coins(amount integer)
RETURNS TABLE(coins integer, season_pass boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_coins integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF amount IS NULL OR amount <= 0 OR amount > 1000000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  INSERT INTO public.user_wallet (user_id)
  VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT w.coins INTO current_coins
  FROM public.user_wallet w
  WHERE w.user_id = auth.uid()
  FOR UPDATE;

  IF current_coins < amount THEN
    RETURN; -- saldo insuficiente: retorna vazio
  END IF;

  UPDATE public.user_wallet w
  SET coins = w.coins - amount, updated_at = now()
  WHERE w.user_id = auth.uid();

  RETURN QUERY
  SELECT w.coins, w.season_pass FROM public.user_wallet w WHERE w.user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.spend_coins(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.spend_coins(integer) TO authenticated;

-- ============ 2. Chat: envio seguro, nome da conta, limites ============
ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_body_len;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_body_len CHECK (char_length(body) BETWEEN 1 AND 500);

DROP POLICY IF EXISTS "Users send own messages" ON public.chat_messages;
REVOKE INSERT ON public.chat_messages FROM authenticated;

CREATE OR REPLACE FUNCTION public.send_chat_message(message_body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- limite de rajada: no máximo 10 mensagens por minuto por usuário
  SELECT count(*) INTO recent_count
  FROM public.chat_messages m
  WHERE m.user_id = auth.uid()
    AND m.created_at > now() - interval '1 minute';
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT COALESCE(
      NULLIF(btrim(u.raw_user_meta_data->>'display_name'), ''),
      NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
      'Técnico'
    )
  INTO sender_name
  FROM auth.users u
  WHERE u.id = auth.uid();

  INSERT INTO public.chat_messages (user_id, display_name, body)
  VALUES (auth.uid(), left(sender_name, 40), clean_body)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_chat_message(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message(text) TO authenticated;

-- ============ 3. Tabelas internas de importação: só o servidor ============
DROP POLICY IF EXISTS "Club external ids are public" ON public.club_external_ids;
DROP POLICY IF EXISTS "Import runs are public" ON public.import_runs;
REVOKE ALL ON public.club_external_ids FROM anon, authenticated;
REVOKE ALL ON public.import_runs FROM anon, authenticated;
GRANT ALL ON public.club_external_ids TO service_role;
GRANT ALL ON public.import_runs TO service_role;
