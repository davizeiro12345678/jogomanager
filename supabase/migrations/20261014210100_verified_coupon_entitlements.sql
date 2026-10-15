-- 2026-10-14 Security hotfix: deny predictable, unlimited rewards.
-- No redemption has been made and no invite allocation exists at deployment time.
-- A campaign can be explicitly re-enabled ONLY after users have been allowlisted.
BEGIN;
UPDATE public.game_coupons
SET active = false
WHERE code IN ('BEMVINDO','VOLTEI','JOGOMANAGER','OLHEIRO','TREINADOR','CRIADOR','VARZEA','CLASSICO')
  AND active = true;

CREATE OR REPLACE FUNCTION public.redeem_game_coupon(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _c public.game_coupons%ROWTYPE;
  _norm text := upper(regexp_replace(coalesce(_code, ''), '\s', '', 'g'));
  _email_verified boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','login');
  END IF;
  -- Authentication alone is not proof of mailbox ownership.
  SELECT (u.email_confirmed_at IS NOT NULL)
  INTO _email_verified
  FROM auth.users u
  WHERE u.id = _uid;
  IF NOT coalesce(_email_verified,false) THEN
    RETURN jsonb_build_object('ok',false,'reason','verify_email');
  END IF;
  IF length(_norm) < 3 OR length(_norm) > 24 OR _norm !~ '^[A-Z0-9]+$' THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid');
  END IF;

  -- Every rewarding code is an explicitly issued grant. Published seed codes
  -- never grant an entitlement simply because a player can guess the text.
  IF NOT EXISTS (
    SELECT 1 FROM public.coupon_eligible_users AS e
    WHERE e.user_id = _uid
      AND e.code = _norm
      AND (e.expires_at IS NULL OR e.expires_at > now())
  ) THEN
    RETURN jsonb_build_object('ok',false,'reason','not_eligible');
  END IF;

  SELECT * INTO _c
  FROM public.game_coupons
  WHERE code = _norm
  FOR UPDATE;
  IF NOT FOUND OR NOT _c.active THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid');
  END IF;
  IF (_c.starts_at IS NOT NULL AND now() < _c.starts_at)
     OR (_c.ends_at IS NOT NULL AND now() > _c.ends_at) THEN
    RETURN jsonb_build_object('ok',false,'reason','expired');
  END IF;
  IF _c.max_redemptions IS NOT NULL AND _c.redemption_count >= _c.max_redemptions THEN
    RETURN jsonb_build_object('ok',false,'reason','sold_out');
  END IF;

  INSERT INTO public.coupon_redemptions(user_id,code)
  VALUES (_uid,_norm) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'reason','used');
  END IF;
  UPDATE public.game_coupons SET redemption_count=redemption_count+1 WHERE code=_norm;
  INSERT INTO public.user_wallet(user_id,coins,scout_reports,training_boosts)
  VALUES (_uid,_c.coins,_c.scout_reports,_c.training_boosts)
  ON CONFLICT(user_id) DO UPDATE SET
    coins=public.user_wallet.coins+EXCLUDED.coins,
    scout_reports=public.user_wallet.scout_reports+EXCLUDED.scout_reports,
    training_boosts=public.user_wallet.training_boosts+EXCLUDED.training_boosts;
  RETURN jsonb_build_object('ok',true,'description',_c.description,'coins',_c.coins,
    'scoutReports',_c.scout_reports,'trainingBoosts',_c.training_boosts);
END;
$fn$;
REVOKE ALL ON FUNCTION public.redeem_game_coupon(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.redeem_game_coupon(text) TO authenticated;
COMMIT;