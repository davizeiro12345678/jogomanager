-- Keep the browser limited to the public product card fields. Stripe lookup
-- keys and fulfillment contents are read only by the payment service role.
ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS stripe_lookup_key text,
  ADD COLUMN IF NOT EXISTS contents jsonb;

UPDATE public.store_products
SET stripe_lookup_key = CASE key
  WHEN 'season_pass' THEN 'season_pass_monthly'
  ELSE key
END
WHERE stripe_lookup_key IS NULL;

UPDATE public.store_products
SET contents = CASE key
  WHEN 'coins_starter' THEN '{"coins":200,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb
  WHEN 'coins_small' THEN '{"coins":500,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb
  WHEN 'coins_medium' THEN '{"coins":1500,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb
  WHEN 'coins_large' THEN '{"coins":4000,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb
  WHEN 'scout_pack' THEN '{"coins":0,"scoutReports":10,"trainingBoosts":0,"themes":[]}'::jsonb
  WHEN 'training_pack' THEN '{"coins":0,"scoutReports":0,"trainingBoosts":1,"themes":[]}'::jsonb
  WHEN 'theme_pack' THEN '{"coins":0,"scoutReports":0,"trainingBoosts":0,"themes":["premium_gold","premium_carbon","neon_stadium"]}'::jsonb
  WHEN 'celebration_pack' THEN '{"coins":0,"scoutReports":0,"trainingBoosts":0,"themes":["celebration_extra"]}'::jsonb
  WHEN 'stadium_pack' THEN '{"coins":0,"scoutReports":0,"trainingBoosts":0,"themes":["stadium_mow","stadium_tifo"]}'::jsonb
  WHEN 'season_pass' THEN '{"coins":0,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb
  ELSE contents
END
WHERE key IN (
  'coins_starter', 'coins_small', 'coins_medium', 'coins_large',
  'scout_pack', 'training_pack', 'theme_pack', 'celebration_pack',
  'stadium_pack', 'season_pass'
);

ALTER TABLE public.store_products
  ALTER COLUMN stripe_lookup_key SET NOT NULL;

-- This function mirrors the server parser: all numeric benefits are whole,
-- non-negative values and each theme is a bounded JSON string. Keeping it in
-- the database prevents a malformed catalog row from becoming a paid offer.
CREATE OR REPLACE FUNCTION public.store_product_contents_valid(_contents jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT
    jsonb_typeof(_contents) = 'object'
    AND jsonb_typeof(_contents -> 'coins') = 'number'
    AND COALESCE((_contents ->> 'coins') ~ '^[0-9]+$', false)
    AND jsonb_typeof(_contents -> 'scoutReports') = 'number'
    AND COALESCE((_contents ->> 'scoutReports') ~ '^[0-9]+$', false)
    AND jsonb_typeof(_contents -> 'trainingBoosts') = 'number'
    AND COALESCE((_contents ->> 'trainingBoosts') ~ '^[0-9]+$', false)
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
$$;

ALTER TABLE public.store_products
  ADD CONSTRAINT store_products_contents_contract
  CHECK (
    contents IS NULL OR public.store_product_contents_valid(contents)
  ) NOT VALID;
ALTER TABLE public.store_products
  VALIDATE CONSTRAINT store_products_contents_contract;

ALTER TABLE public.store_products
  ADD CONSTRAINT store_products_currency_code
  CHECK (currency ~ '^[A-Za-z]{3}$') NOT VALID;
ALTER TABLE public.store_products
  VALIDATE CONSTRAINT store_products_currency_code;

ALTER TABLE public.guest_checkout_intents
  ADD CONSTRAINT guest_checkout_intents_contents_snapshot_contract
  CHECK (public.store_product_contents_valid(contents_snapshot)) NOT VALID;
ALTER TABLE public.guest_checkout_intents
  VALIDATE CONSTRAINT guest_checkout_intents_contents_snapshot_contract;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.store_products
    WHERE active = true
      AND (
        contents IS NULL
        OR NOT public.store_product_contents_valid(contents)
      )
  ) THEN
    RAISE EXCEPTION 'Every active store product must define a complete contents object before checkout is enabled.';
  END IF;
END;
$$;

-- Table-level SELECT would expose the new private columns to anon users.
REVOKE SELECT ON public.store_products FROM anon, authenticated;
GRANT SELECT (key, name, description, price_cents, currency, coins, kind, active)
  ON public.store_products TO anon, authenticated;
GRANT ALL ON public.store_products TO service_role;

-- The verified Stripe webhook and authenticated return handler call this RPC.
-- Purchase-state transition and wallet credit commit as one idempotent change.
CREATE OR REPLACE FUNCTION public.fulfill_store_purchase(
  _user_id uuid,
  _product_key text,
  _reference text,
  _amount_cents integer,
  _coins integer,
  _scout_reports integer,
  _training_boosts integer,
  _themes text[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed boolean := false;
BEGIN
  IF _reference IS NULL OR char_length(_reference) = 0
    OR _amount_cents < 0 OR _coins < 0 OR _scout_reports < 0 OR _training_boosts < 0 THEN
    RAISE EXCEPTION 'Invalid fulfillment values';
  END IF;

  UPDATE public.user_purchases
  SET
    product_key = _product_key,
    amount_cents = _amount_cents,
    status = 'completed',
    error = NULL,
    updated_at = now()
  WHERE reference = _reference
    AND user_id = _user_id
    AND status <> 'completed';
  changed := FOUND;

  IF NOT changed THEN
    INSERT INTO public.user_purchases (
      user_id, product_key, amount_cents, status, error, reference
    ) VALUES (
      _user_id, _product_key, _amount_cents, 'completed', NULL, _reference
    )
    ON CONFLICT (reference) DO NOTHING;
    changed := FOUND;
  END IF;

  IF NOT changed THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_wallet (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_wallet AS wallet
  SET
    coins = wallet.coins + _coins,
    scout_reports = wallet.scout_reports + _scout_reports,
    training_boosts = wallet.training_boosts + _training_boosts,
    unlocked_themes = ARRAY(
      SELECT DISTINCT theme
      FROM unnest(COALESCE(wallet.unlocked_themes, ARRAY[]::text[]) || COALESCE(_themes, ARRAY[]::text[])) AS theme
      WHERE char_length(theme) > 0
    ),
    updated_at = now()
  WHERE wallet.user_id = _user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_store_purchase(uuid, text, text, integer, integer, integer, integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfill_store_purchase(uuid, text, text, integer, integer, integer, integer, text[]) TO service_role;