ALTER TABLE public.user_wallet
  ADD COLUMN IF NOT EXISTS injury_treatments integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opponent_reports integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_wallet
  ADD CONSTRAINT user_wallet_stored_services_nonnegative
  CHECK (injury_treatments >= 0 AND opponent_reports >= 0);

-- Stored items bought in the shop are used at no coin cost; the row keeps how it was paid.
ALTER TABLE public.coin_service_spends DROP CONSTRAINT IF EXISTS coin_service_spends_cost_check;
ALTER TABLE public.coin_service_spends ADD CONSTRAINT coin_service_spends_cost_check CHECK (cost >= 0);
ALTER TABLE public.coin_service_spends ADD COLUMN IF NOT EXISTS paid_with text NOT NULL DEFAULT 'coins';
ALTER TABLE public.coin_service_spends ADD CONSTRAINT coin_service_spends_paid_with_check
  CHECK (paid_with IN ('coins', 'stored_item'));

-- Optional counters for the new service packs; older rows without them stay valid.
CREATE OR REPLACE FUNCTION public.store_product_contents_valid(_contents jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  SELECT
    jsonb_typeof(_contents) = 'object'
    AND jsonb_typeof(_contents -> 'coins') = 'number'
    AND COALESCE((_contents ->> 'coins') ~ '^[0-9]+$', false)
    AND jsonb_typeof(_contents -> 'scoutReports') = 'number'
    AND COALESCE((_contents ->> 'scoutReports') ~ '^[0-9]+$', false)
    AND jsonb_typeof(_contents -> 'trainingBoosts') = 'number'
    AND COALESCE((_contents ->> 'trainingBoosts') ~ '^[0-9]+$', false)
    AND (NOT (_contents ? 'injuryTreatments') OR (jsonb_typeof(_contents -> 'injuryTreatments') = 'number'
      AND COALESCE((_contents ->> 'injuryTreatments') ~ '^[0-9]+$', false)))
    AND (NOT (_contents ? 'opponentReports') OR (jsonb_typeof(_contents -> 'opponentReports') = 'number'
      AND COALESCE((_contents ->> 'opponentReports') ~ '^[0-9]+$', false)))
    AND jsonb_typeof(_contents -> 'themes') = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(_contents -> 'themes') = 'array' THEN _contents -> 'themes'
          ELSE '[]'::jsonb
        END
      ) AS theme(value)
      WHERE jsonb_typeof(theme.value) <> 'string'
         OR char_length(theme.value #>> '{}') > 80
    );
$function$;

CREATE OR REPLACE FUNCTION public.fulfill_store_purchase(_user_id uuid, _product_key text, _reference text, _amount_cents integer, _coins integer, _scout_reports integer, _training_boosts integer, _themes text[], _injury_treatments integer, _opponent_reports integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  changed boolean := false;
BEGIN
  IF _reference IS NULL OR char_length(_reference) = 0
    OR _amount_cents < 0 OR _coins < 0 OR _scout_reports < 0 OR _training_boosts < 0
    OR _injury_treatments < 0 OR _opponent_reports < 0 THEN
    RAISE EXCEPTION 'Invalid fulfillment values';
  END IF;

  UPDATE public.user_purchases
  SET product_key = _product_key, amount_cents = _amount_cents, status = 'completed', error = NULL, updated_at = now()
  WHERE reference = _reference AND user_id = _user_id AND status <> 'completed';
  changed := FOUND;

  IF NOT changed THEN
    INSERT INTO public.user_purchases (user_id, product_key, amount_cents, status, error, reference)
    VALUES (_user_id, _product_key, _amount_cents, 'completed', NULL, _reference)
    ON CONFLICT (reference) DO NOTHING;
    changed := FOUND;
  END IF;

  IF NOT changed THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_wallet (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_wallet AS wallet
  SET
    coins = wallet.coins + _coins,
    scout_reports = wallet.scout_reports + _scout_reports,
    training_boosts = wallet.training_boosts + _training_boosts,
    injury_treatments = wallet.injury_treatments + _injury_treatments,
    opponent_reports = wallet.opponent_reports + _opponent_reports,
    unlocked_themes = ARRAY(
      SELECT DISTINCT theme
      FROM unnest(COALESCE(wallet.unlocked_themes, ARRAY[]::text[]) || COALESCE(_themes, ARRAY[]::text[])) AS theme
      WHERE char_length(theme) > 0
    ),
    updated_at = now()
  WHERE wallet.user_id = _user_id;

  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.fulfill_store_purchase(uuid, text, text, integer, integer, integer, integer, text[], integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_store_purchase(uuid, text, text, integer, integer, integer, integer, text[], integer, integer) TO service_role;

-- A stored treatment or report from a shop pack is used first; otherwise coins are charged.
-- The weekly limit applies either way so bought items never bypass game balance.
CREATE OR REPLACE FUNCTION public.spend_coins_on_service(_user_id uuid, _service text, _request_id uuid)
 RETURNS TABLE(ok boolean, reason text, coins integer, used_this_week integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  cost integer;
  weekly_limit integer;
  used integer;
  stored integer;
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

  IF EXISTS (SELECT 1 FROM public.coin_service_spends s WHERE s.user_id = _user_id AND s.request_id = _request_id) THEN
    RETURN QUERY SELECT true, 'duplicate'::text, w.coins, used;
    RETURN;
  END IF;
  IF used >= weekly_limit THEN
    RETURN QUERY SELECT false, 'weekly_limit'::text, w.coins, used;
    RETURN;
  END IF;

  stored := CASE _service WHEN 'injury_recovery' THEN w.injury_treatments ELSE w.opponent_reports END;
  IF stored > 0 THEN
    IF _service = 'injury_recovery' THEN
      UPDATE public.user_wallet uw SET injury_treatments = uw.injury_treatments - 1, updated_at = now()
        WHERE uw.user_id = _user_id RETURNING uw.* INTO w;
    ELSE
      UPDATE public.user_wallet uw SET opponent_reports = uw.opponent_reports - 1, updated_at = now()
        WHERE uw.user_id = _user_id RETURNING uw.* INTO w;
    END IF;
    INSERT INTO public.coin_service_spends (user_id, request_id, service, cost, paid_with)
      VALUES (_user_id, _request_id, _service, 0, 'stored_item');
    INSERT INTO public.wallet_item_log (user_id, item, detail)
      VALUES (_user_id, _service, 'item guardado do pacote');
    RETURN QUERY SELECT true, 'stored_item'::text, w.coins, used + 1;
    RETURN;
  END IF;

  IF w.coins < cost THEN
    RETURN QUERY SELECT false, 'not_enough_coins'::text, w.coins, used;
    RETURN;
  END IF;

  UPDATE public.user_wallet uw SET coins = uw.coins - cost, updated_at = now()
    WHERE uw.user_id = _user_id RETURNING uw.* INTO w;
  INSERT INTO public.coin_service_spends (user_id, request_id, service, cost, paid_with)
    VALUES (_user_id, _request_id, _service, cost, 'coins');
  INSERT INTO public.wallet_item_log (user_id, item, detail)
    VALUES (_user_id, _service, 'serviço por ' || cost || ' moedas');
  RETURN QUERY SELECT true, 'ok'::text, w.coins, used + 1;
END;
$function$;
REVOKE ALL ON FUNCTION public.spend_coins_on_service(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_coins_on_service(uuid, text, uuid) TO service_role;