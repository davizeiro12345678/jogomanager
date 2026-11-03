CREATE OR REPLACE FUNCTION public.spend_coins_on_service(_user_id uuid, _service text, _request_id uuid)
 RETURNS TABLE(ok boolean, reason text, coins integer, used_this_week integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
#variable_conflict use_column
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

  INSERT INTO public.user_wallet AS uw (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.user_wallet uw WHERE uw.user_id = _user_id FOR UPDATE;

  SELECT count(*)::int INTO used FROM public.coin_service_spends s
    WHERE s.user_id = _user_id AND s.service = _service AND s.created_at > now() - interval '7 days';

  -- Same request again: report success, charge nothing.
  IF EXISTS (SELECT 1 FROM public.coin_service_spends s WHERE s.user_id = _user_id AND s.request_id = _request_id) THEN
    RETURN QUERY SELECT true, 'duplicate'::text, w.coins, used;
    RETURN;
  END IF;
  IF used >= weekly_limit THEN
    RETURN QUERY SELECT false, 'weekly_limit'::text, w.coins, used;
    RETURN;
  END IF;
  IF w.coins < cost THEN
    RETURN QUERY SELECT false, 'not_enough_coins'::text, w.coins, used;
    RETURN;
  END IF;

  UPDATE public.user_wallet uw SET coins = uw.coins - cost, updated_at = now()
    WHERE uw.user_id = _user_id RETURNING uw.* INTO w;
  INSERT INTO public.coin_service_spends (user_id, request_id, service, cost)
    VALUES (_user_id, _request_id, _service, cost);
  INSERT INTO public.wallet_item_log (user_id, item, detail)
    VALUES (_user_id, _service, 'serviço por ' || cost || ' moedas');
  RETURN QUERY SELECT true, 'ok'::text, w.coins, used + 1;
END;
$function$;
REVOKE ALL ON FUNCTION public.spend_coins_on_service(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_coins_on_service(uuid, text, uuid) TO service_role;