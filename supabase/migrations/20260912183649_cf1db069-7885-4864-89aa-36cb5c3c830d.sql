-- ============ Orçamento de IA e voz ============
CREATE TABLE public.ai_budget_usage (
  month text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('text','voice')),
  spent_cents integer NOT NULL DEFAULT 0,
  requests integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (month, kind)
);
GRANT ALL ON public.ai_budget_usage TO service_role;
ALTER TABLE public.ai_budget_usage ENABLE ROW LEVEL SECURITY;

-- Reserva antes do pedido: devolve false quando o teto do mês foi atingido.
CREATE OR REPLACE FUNCTION public.reserve_ai_budget(_kind text, _cents integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cap integer;
  used integer;
  m text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
BEGIN
  IF _kind NOT IN ('text','voice') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
  IF _cents IS NULL OR _cents < 0 OR _cents > 100000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  cap := CASE WHEN _kind = 'text' THEN 35000 ELSE 15000 END;

  INSERT INTO public.ai_budget_usage (month, kind) VALUES (m, _kind)
  ON CONFLICT (month, kind) DO NOTHING;

  SELECT u.spent_cents INTO used FROM public.ai_budget_usage u
    WHERE u.month = m AND u.kind = _kind FOR UPDATE;

  IF used + _cents > cap THEN RETURN false; END IF;

  UPDATE public.ai_budget_usage u
    SET spent_cents = u.spent_cents + _cents, requests = u.requests + 1, updated_at = now()
    WHERE u.month = m AND u.kind = _kind;
  RETURN true;
END;
$$;

-- ============ Comunidade: bloqueio e denúncia ============
CREATE TABLE public.user_blocks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks read" ON public.user_blocks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own blocks insert" ON public.user_blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND blocked_id <> auth.uid());
CREATE POLICY "own blocks delete" ON public.user_blocks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.chat_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, reporter_id)
);
GRANT SELECT, INSERT ON public.chat_reports TO authenticated;
GRANT ALL ON public.chat_reports TO service_role;
ALTER TABLE public.chat_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reports read" ON public.chat_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "own reports insert" ON public.chat_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- Mensagens de quem eu bloqueei somem da minha lista.
DROP POLICY IF EXISTS "Signed in users read chat" ON public.chat_messages;
CREATE POLICY "Signed in users read chat" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    hidden = false
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE b.user_id = auth.uid() AND b.blocked_id = chat_messages.user_id
    )
  );

-- ============ Impulso de treino semanal ============
CREATE TABLE public.user_boosts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  training_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_boosts TO authenticated;
GRANT ALL ON public.user_boosts TO service_role;
ALTER TABLE public.user_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own boost read" ON public.user_boosts FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Consome um impulso da carteira e vale por 7 dias. Não acumula: ativar de
-- novo enquanto está ativo apenas recomeça a semana.
CREATE OR REPLACE FUNCTION public.activate_training_boost(_user_id uuid)
RETURNS TABLE(training_until timestamptz, training_boosts integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  left_over integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  INSERT INTO public.user_wallet (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_boosts (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;

  SELECT w.training_boosts INTO left_over FROM public.user_wallet w
    WHERE w.user_id = _user_id FOR UPDATE;
  IF left_over IS NULL OR left_over < 1 THEN RETURN; END IF;

  UPDATE public.user_wallet w SET training_boosts = w.training_boosts - 1, updated_at = now()
    WHERE w.user_id = _user_id;
  UPDATE public.user_boosts b SET training_until = now() + interval '7 days', updated_at = now()
    WHERE b.user_id = _user_id;
  INSERT INTO public.wallet_item_log (user_id, item, detail)
    VALUES (_user_id, 'training_boost', 'impulso semanal ativado');

  RETURN QUERY
    SELECT b.training_until, w.training_boosts
    FROM public.user_boosts b JOIN public.user_wallet w ON w.user_id = b.user_id
    WHERE b.user_id = _user_id;
END;
$$;