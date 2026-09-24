CREATE TABLE public.game_coupons (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9]{3,24}$'),
  description text NOT NULL,
  coins integer NOT NULL DEFAULT 0 CHECK (coins BETWEEN 0 AND 5000),
  scout_reports integer NOT NULL DEFAULT 0 CHECK (scout_reports BETWEEN 0 AND 20),
  training_boosts integer NOT NULL DEFAULT 0 CHECK (training_boosts BETWEEN 0 AND 20),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redemption_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.game_coupons TO service_role;
ALTER TABLE public.game_coupons ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL REFERENCES public.game_coupons(code),
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.redeem_game_coupon(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _c public.game_coupons%ROWTYPE;
  _norm text := upper(regexp_replace(coalesce(_code, ''), '\s', '', 'g'));
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'login'); END IF;
  SELECT * INTO _c FROM public.game_coupons WHERE code = _norm FOR UPDATE;
  IF NOT FOUND OR NOT _c.active THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;
  IF (_c.starts_at IS NOT NULL AND now() < _c.starts_at) OR (_c.ends_at IS NOT NULL AND now() > _c.ends_at) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF _c.max_redemptions IS NOT NULL AND _c.redemption_count >= _c.max_redemptions THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sold_out');
  END IF;
  INSERT INTO public.coupon_redemptions (user_id, code) VALUES (_uid, _norm) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'used'); END IF;
  UPDATE public.game_coupons SET redemption_count = redemption_count + 1 WHERE code = _norm;
  INSERT INTO public.user_wallet (user_id, coins, scout_reports, training_boosts)
    VALUES (_uid, _c.coins, _c.scout_reports, _c.training_boosts)
  ON CONFLICT (user_id) DO UPDATE SET
    coins = user_wallet.coins + EXCLUDED.coins,
    scout_reports = user_wallet.scout_reports + EXCLUDED.scout_reports,
    training_boosts = user_wallet.training_boosts + EXCLUDED.training_boosts;
  RETURN jsonb_build_object('ok', true, 'description', _c.description, 'coins', _c.coins,
    'scoutReports', _c.scout_reports, 'trainingBoosts', _c.training_boosts);
END $$;
REVOKE ALL ON FUNCTION public.redeem_game_coupon(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_game_coupon(text) TO authenticated;

INSERT INTO public.game_coupons (code, description, coins, scout_reports, training_boosts) VALUES
  ('BEMVINDO', 'Presente de boas-vindas', 500, 2, 2),
  ('VOLTEI', 'De volta ao jogo', 300, 0, 3),
  ('JOGOMANAGER', 'Cupom oficial do JogoManager', 250, 1, 1),
  ('OLHEIRO', 'Pacote de olheiros', 0, 5, 0),
  ('TREINADOR', 'Sessões extras de treino', 0, 0, 5),
  ('CRIADOR', 'Cupom de criador de conteúdo', 400, 3, 0),
  ('VARZEA', 'Raiz do futebol brasileiro', 150, 1, 1),
  ('CLASSICO', 'Dia de clássico', 200, 0, 2);

ALTER TABLE public.store_products
  ADD COLUMN sale_percent_off integer CHECK (sale_percent_off IS NULL OR sale_percent_off BETWEEN 1 AND 90),
  ADD COLUMN sale_starts_at timestamptz,
  ADD COLUMN sale_ends_at timestamptz;
GRANT SELECT (sale_percent_off, sale_starts_at, sale_ends_at) ON public.store_products TO anon, authenticated;

UPDATE public.store_products SET sale_percent_off = 20, sale_starts_at = now(), sale_ends_at = now() + interval '30 days'
  WHERE key IN ('coins_medium', 'coins_large');
UPDATE public.store_products SET sale_percent_off = 15, sale_starts_at = now(), sale_ends_at = now() + interval '30 days'
  WHERE key = 'season_pass';