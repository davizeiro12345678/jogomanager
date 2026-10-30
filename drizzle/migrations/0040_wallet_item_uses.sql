ALTER TABLE public.user_wallet ADD COLUMN IF NOT EXISTS pass_coins_claimed_at timestamptz;

-- Stacking boosts extend the active week instead of restarting it, so several boosts are never wasted.
CREATE OR REPLACE FUNCTION public.activate_training_boost(_user_id uuid)
 RETURNS TABLE(training_until timestamp with time zone, training_boosts integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE left_over integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.user_wallet (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_boosts (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT w.training_boosts INTO left_over FROM public.user_wallet w WHERE w.user_id = _user_id FOR UPDATE;
  IF left_over IS NULL OR left_over < 1 THEN RETURN; END IF;
  UPDATE public.user_wallet w SET training_boosts = w.training_boosts - 1, updated_at = now() WHERE w.user_id = _user_id;
  UPDATE public.user_boosts b
    SET training_until = GREATEST(now(), COALESCE(b.training_until, now())) + interval '7 days', updated_at = now()
    WHERE b.user_id = _user_id;
  INSERT INTO public.wallet_item_log (user_id, item, detail) VALUES (_user_id, 'training_boost', 'impulso semanal ativado');
  RETURN QUERY SELECT b.training_until, w.training_boosts
    FROM public.user_boosts b JOIN public.user_wallet w ON w.user_id = b.user_id WHERE b.user_id = _user_id;
END;
$function$;

-- Season pass holders scout for free; everyone else spends one stored report.
CREATE OR REPLACE FUNCTION public.use_scout_report(_user_id uuid)
 RETURNS TABLE(used boolean, scout_reports integer, free_with_pass boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE w public.user_wallet%ROWTYPE; has_pass boolean;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.user_wallet (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.user_wallet WHERE user_id = _user_id FOR UPDATE;
  has_pass := w.season_pass AND w.season_pass_until IS NOT NULL AND w.season_pass_until > now();
  IF has_pass THEN
    INSERT INTO public.wallet_item_log (user_id, item, detail) VALUES (_user_id, 'scout_report', 'relatório do passe');
    RETURN QUERY SELECT true, w.scout_reports, true;
    RETURN;
  END IF;
  IF w.scout_reports < 1 THEN
    RETURN QUERY SELECT false, w.scout_reports, false;
    RETURN;
  END IF;
  UPDATE public.user_wallet SET scout_reports = scout_reports - 1, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO public.wallet_item_log (user_id, item, detail) VALUES (_user_id, 'scout_report', 'relatório premium');
  RETURN QUERY SELECT true, w.scout_reports - 1, false;
END;
$function$;

-- Fixed exchange rates: 150 coins per scout report, 400 coins per training boost.
CREATE OR REPLACE FUNCTION public.exchange_coins_for_item(_user_id uuid, _item text)
 RETURNS TABLE(ok boolean, coins integer, scout_reports integer, training_boosts integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE cost integer; w public.user_wallet%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  cost := CASE _item WHEN 'scout_report' THEN 150 WHEN 'training_boost' THEN 400 END;
  IF cost IS NULL THEN RAISE EXCEPTION 'invalid_item'; END IF;
  INSERT INTO public.user_wallet (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.user_wallet WHERE user_id = _user_id FOR UPDATE;
  IF w.coins < cost THEN
    RETURN QUERY SELECT false, w.coins, w.scout_reports, w.training_boosts;
    RETURN;
  END IF;
  UPDATE public.user_wallet SET
    coins = coins - cost,
    scout_reports = scout_reports + CASE WHEN _item = 'scout_report' THEN 1 ELSE 0 END,
    training_boosts = training_boosts + CASE WHEN _item = 'training_boost' THEN 1 ELSE 0 END,
    updated_at = now()
  WHERE user_id = _user_id
  RETURNING * INTO w;
  INSERT INTO public.wallet_item_log (user_id, item, detail) VALUES (_user_id, _item, 'troca por ' || cost || ' moedas');
  RETURN QUERY SELECT true, w.coins, w.scout_reports, w.training_boosts;
END;
$function$;

-- Season pass: 300 coins once every 7 days while the pass is active.
CREATE OR REPLACE FUNCTION public.claim_season_pass_coins(_user_id uuid)
 RETURNS TABLE(claimed boolean, coins integer, next_claim_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE w public.user_wallet%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.user_wallet (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.user_wallet WHERE user_id = _user_id FOR UPDATE;
  IF NOT (w.season_pass AND w.season_pass_until IS NOT NULL AND w.season_pass_until > now()) THEN
    RETURN QUERY SELECT false, w.coins, NULL::timestamptz;
    RETURN;
  END IF;
  IF w.pass_coins_claimed_at IS NOT NULL AND w.pass_coins_claimed_at > now() - interval '7 days' THEN
    RETURN QUERY SELECT false, w.coins, w.pass_coins_claimed_at + interval '7 days';
    RETURN;
  END IF;
  UPDATE public.user_wallet SET coins = coins + 300, pass_coins_claimed_at = now(), updated_at = now()
    WHERE user_id = _user_id RETURNING * INTO w;
  INSERT INTO public.wallet_item_log (user_id, item, detail) VALUES (_user_id, 'pass_coins', '300 moedas semanais do passe');
  RETURN QUERY SELECT true, w.coins, w.pass_coins_claimed_at + interval '7 days';
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_training_boost(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.use_scout_report(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.exchange_coins_for_item(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_season_pass_coins(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_training_boost(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.use_scout_report(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.exchange_coins_for_item(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_season_pass_coins(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';