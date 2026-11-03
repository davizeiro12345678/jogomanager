-- Append-only ledger of coin services; request_id makes retries count once.
CREATE TABLE public.coin_service_spends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  service text NOT NULL CHECK (service IN ('injury_recovery', 'opponent_report')),
  cost integer NOT NULL CHECK (cost > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id)
);
CREATE INDEX coin_service_spends_user_time ON public.coin_service_spends (user_id, created_at DESC);

GRANT SELECT ON public.coin_service_spends TO authenticated;
GRANT ALL ON public.coin_service_spends TO service_role;
ALTER TABLE public.coin_service_spends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read their own coin services"
  ON public.coin_service_spends FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Prices and limits live here; the app shows the same values from wallet-rules.
CREATE OR REPLACE FUNCTION public.spend_coins_on_service(_user_id uuid, _service text, _request_id uuid)
 RETURNS TABLE(ok boolean, reason text, coins integer, used_this_week integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  cost integer;
  weekly_limit integer;
  used integer;
  w public.user_wallet%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _request_id IS NULL THEN RAISE EXCEPTION 'missing_request_id'; END IF;
  cost := CASE _service WHEN 'injury_recovery' THEN 250 WHEN 'opponent_report' THEN 100 END;
  weekly_limit := CASE _service WHEN 'injury_recovery' THEN 3 WHEN 'opponent_report' THEN 10 END;
  IF cost IS NULL THEN RAISE EXCEPTION 'invalid_service'; END IF;

  INSERT INTO public.user_wallet (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.user_wallet WHERE user_id = _user_id FOR UPDATE;

  -- Same request again: report the original result, charge nothing.
  IF EXISTS (SELECT 1 FROM public.coin_service_spends s WHERE s.user_id = _user_id AND s.request_id = _request_id) THEN
    SELECT count(*)::int INTO used FROM public.coin_service_spends s
      WHERE s.user_id = _user_id AND s.service = _service AND s.created_at > now() - interval '7 days';
    RETURN QUERY SELECT true, 'duplicate'::text, w.coins, used;
    RETURN;
  END IF;

  SELECT count(*)::int INTO used FROM public.coin_service_spends s
    WHERE s.user_id = _user_id AND s.service = _service AND s.created_at > now() - interval '7 days';
  IF used >= weekly_limit THEN
    RETURN QUERY SELECT false, 'weekly_limit'::text, w.coins, used;
    RETURN;
  END IF;
  IF w.coins < cost THEN
    RETURN QUERY SELECT false, 'not_enough_coins'::text, w.coins, used;
    RETURN;
  END IF;

  UPDATE public.user_wallet SET coins = coins - cost, updated_at = now()
    WHERE user_id = _user_id RETURNING * INTO w;
  INSERT INTO public.coin_service_spends (user_id, request_id, service, cost)
    VALUES (_user_id, _request_id, _service, cost);
  INSERT INTO public.wallet_item_log (user_id, item, detail)
    VALUES (_user_id, _service, 'serviço por ' || cost || ' moedas');
  RETURN QUERY SELECT true, 'ok'::text, w.coins, used + 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.spend_coins_on_service(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_coins_on_service(uuid, text, uuid) TO service_role;

-- Coins can never go negative, whatever path writes the wallet.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_wallet_coins_nonnegative') THEN
    ALTER TABLE public.user_wallet ADD CONSTRAINT user_wallet_coins_nonnegative CHECK (coins >= 0) NOT VALID;
  END IF;
END $$;