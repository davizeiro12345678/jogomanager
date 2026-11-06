CREATE OR REPLACE FUNCTION public.spend_coins_on_service(_user_id uuid, _service text, _request_id uuid)
RETURNS TABLE(ok boolean, reason text, coins integer, used_this_week integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
 cost integer; weekly_limit integer; used integer; stored integer := 0;
 previous public.coin_service_spends%ROWTYPE;
 w public.user_wallet%ROWTYPE;
BEGIN
 IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF _request_id IS NULL THEN RAISE EXCEPTION 'missing_request_id'; END IF;
 cost := CASE _service WHEN 'injury_recovery' THEN 250 WHEN 'opponent_report' THEN 100
 WHEN 'youth_boost' THEN 300 WHEN 'stadium_upgrade' THEN 500 WHEN 'contract_renewal' THEN 200
 WHEN 'training_upgrade' THEN 150 WHEN 'premium_scout' THEN 120 END;
 weekly_limit := CASE _service WHEN 'injury_recovery' THEN 3 WHEN 'opponent_report' THEN 10
 WHEN 'youth_boost' THEN 2 WHEN 'stadium_upgrade' THEN 1 WHEN 'contract_renewal' THEN 3
 WHEN 'training_upgrade' THEN 5 WHEN 'premium_scout' THEN 7 END;
 IF cost IS NULL THEN RAISE EXCEPTION 'invalid_service'; END IF;
 INSERT INTO public.user_wallet AS uw(user_id) VALUES (_user_id) ON CONFLICT(user_id) DO NOTHING;
 SELECT * INTO w FROM public.user_wallet uw WHERE uw.user_id = _user_id FOR UPDATE;
 SELECT count(*)::int INTO used FROM public.coin_service_spends s WHERE s.user_id = _user_id
 AND s.service = _service AND s.created_at > now() - interval '7 days';
 SELECT * INTO previous FROM public.coin_service_spends s WHERE s.user_id = _user_id AND s.request_id = _request_id;
 IF FOUND THEN
 IF previous.service <> _service THEN RETURN QUERY SELECT false, 'request_conflict'::text, w.coins, used;
 ELSE RETURN QUERY SELECT true, 'duplicate'::text, w.coins, used; END IF;
 RETURN;
 END IF;
 IF used >= weekly_limit THEN RETURN QUERY SELECT false, 'weekly_limit'::text, w.coins, used; RETURN; END IF;
 IF _service = 'injury_recovery' THEN stored := w.injury_treatments;
 ELSIF _service = 'opponent_report' THEN stored := w.opponent_reports; END IF;
 IF stored > 0 THEN
 IF _service = 'injury_recovery' THEN UPDATE public.user_wallet uw SET injury_treatments = uw.injury_treatments - 1, updated_at = now() WHERE uw.user_id = _user_id RETURNING uw.* INTO w;
 ELSE UPDATE public.user_wallet uw SET opponent_reports = uw.opponent_reports - 1, updated_at = now() WHERE uw.user_id = _user_id RETURNING uw.* INTO w; END IF;
 INSERT INTO public.coin_service_spends(user_id, request_id, service, cost, paid_with) VALUES (_user_id, _request_id, _service, 0, 'stored_item');
 INSERT INTO public.wallet_item_log(user_id, item, detail) VALUES (_user_id, _service, 'item guardado do pacote');
 RETURN QUERY SELECT true, 'stored_item'::text, w.coins, used + 1; RETURN;
 END IF;
 IF w.coins < cost THEN RETURN QUERY SELECT false, 'not_enough_coins'::text, w.coins, used; RETURN; END IF;
 UPDATE public.user_wallet uw SET coins = uw.coins - cost, updated_at = now() WHERE uw.user_id = _user_id RETURNING uw.* INTO w;
 INSERT INTO public.coin_service_spends(user_id, request_id, service, cost, paid_with) VALUES (_user_id, _request_id, _service, cost, 'coins');
 INSERT INTO public.wallet_item_log(user_id, item, detail) VALUES (_user_id, _service, 'serviço por ' || cost || ' moedas');
 RETURN QUERY SELECT true, 'ok'::text, w.coins, used + 1;
END;
$function$;
REVOKE ALL ON FUNCTION public.spend_coins_on_service(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_coins_on_service(uuid,text,uuid) TO service_role;