-- Additive, provider-neutral rights model for VIP and permanent cosmetics.
-- This migration deliberately creates no Stripe Product, Price, Checkout Session
-- or webhook configuration. Activation remains an explicit, later operation.

CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'none' CHECK (tier IN ('none', 'vip', 'vip_max')),
  valid_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (tier = 'none' AND valid_until IS NULL)
    OR (tier IN ('vip', 'vip_max') AND valid_until IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.user_cosmetic_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cosmetic_key text NOT NULL CHECK (cosmetic_key ~ '^[a-z0-9][a-z0-9_-]{1,95}$'),
  cosmetic_family text NOT NULL CHECK (
    cosmetic_family IN ('theme', 'crest', 'kit', 'celebration', 'stadium', 'crowd', 'tunnel', 'trophy', 'hud', 'replay', 'profile')
  ),
  permanent boolean NOT NULL DEFAULT true,
  valid_until timestamptz,
  source_reference text NOT NULL CHECK (char_length(btrim(source_reference)) BETWEEN 1 AND 192),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((permanent IS TRUE AND valid_until IS NULL) OR (permanent IS FALSE AND valid_until IS NOT NULL)),
  UNIQUE (user_id, cosmetic_key),
  UNIQUE (user_id, cosmetic_key, cosmetic_family),
  UNIQUE (user_id, source_reference, cosmetic_key)
);

CREATE TABLE IF NOT EXISTS public.user_equipped_cosmetics (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cosmetic_family text NOT NULL CHECK (
    cosmetic_family IN ('theme', 'crest', 'kit', 'celebration', 'stadium', 'crowd', 'tunnel', 'trophy', 'hud', 'replay', 'profile')
  ),
  cosmetic_key text NOT NULL CHECK (cosmetic_key ~ '^[a-z0-9][a-z0-9_-]{1,95}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cosmetic_family),
  FOREIGN KEY (user_id, cosmetic_key, cosmetic_family)
    REFERENCES public.user_cosmetic_grants (user_id, cosmetic_key, cosmetic_family)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.entitlement_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9:._-]{7,191}$'),
  action text NOT NULL CHECK (action IN ('legacy_migration', 'subscription_set', 'cosmetic_granted', 'cosmetic_equipped', 'entitlement_revoked')),
  tier text CHECK (tier IS NULL OR tier IN ('none', 'vip', 'vip_max')),
  cosmetic_family text CHECK (
    cosmetic_family IS NULL
    OR cosmetic_family IN ('theme', 'crest', 'kit', 'celebration', 'stadium', 'crowd', 'tunnel', 'trophy', 'hud', 'replay', 'profile')
  ),
  cosmetic_key text CHECK (cosmetic_key IS NULL OR cosmetic_key ~ '^[a-z0-9][a-z0-9_-]{1,95}$'),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS user_cosmetic_grants_user_family_idx
  ON public.user_cosmetic_grants (user_id, cosmetic_family);
CREATE INDEX IF NOT EXISTS entitlement_ledger_user_occurred_idx
  ON public.entitlement_ledger (user_id, occurred_at DESC);

-- A currently valid legacy season pass becomes VIP once. An old boolean is not
-- enough to create access after expiry, and no existing entitlement is replaced.
INSERT INTO public.user_entitlements (user_id, tier, valid_until)
SELECT
  wallet.user_id,
  CASE
    WHEN wallet.season_pass IS TRUE AND wallet.season_pass_until > now() THEN 'vip'
    ELSE 'none'
  END,
  CASE
    WHEN wallet.season_pass IS TRUE AND wallet.season_pass_until > now() THEN wallet.season_pass_until
    ELSE NULL
  END
FROM public.user_wallet AS wallet
ON CONFLICT (user_id) DO NOTHING;

-- Existing purchased themes are permanently owned; their legacy list never
-- becomes a temporary VIP library. The install is idempotent by ownership key.
WITH legacy_themes AS (
  SELECT wallet.user_id, btrim(theme) AS cosmetic_key
  FROM public.user_wallet AS wallet
  CROSS JOIN LATERAL unnest(COALESCE(wallet.unlocked_themes, ARRAY[]::text[])) AS themes(theme)
  WHERE btrim(theme) ~ '^[a-z0-9][a-z0-9_-]{1,95}$'
)
INSERT INTO public.user_cosmetic_grants (
  user_id, cosmetic_key, cosmetic_family, permanent, valid_until, source_reference
)
SELECT
  user_id,
  cosmetic_key,
  'theme',
  TRUE,
  NULL,
  format('legacy-wallet-theme:%s:%s', user_id, cosmetic_key)
FROM legacy_themes
ON CONFLICT (user_id, cosmetic_key) DO NOTHING;

INSERT INTO public.entitlement_ledger (
  user_id, idempotency_key, action, tier, details, occurred_at
)
SELECT
  entitlement.user_id,
  format('legacy-wallet-entitlement:%s', entitlement.user_id),
  'legacy_migration',
  entitlement.tier,
  jsonb_build_object('source', 'user_wallet'),
  now()
FROM public.user_entitlements AS entitlement
ON CONFLICT (idempotency_key) DO NOTHING;

-- The client may read its own rights but cannot grant, equip or revoke them.
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cosmetic_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_equipped_cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_ledger ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_entitlements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_cosmetic_grants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_equipped_cosmetics FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.entitlement_ledger FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.user_entitlements TO authenticated;
GRANT SELECT ON TABLE public.user_cosmetic_grants TO authenticated;
GRANT SELECT ON TABLE public.user_equipped_cosmetics TO authenticated;
GRANT SELECT ON TABLE public.entitlement_ledger TO authenticated;
GRANT ALL ON TABLE public.user_entitlements TO service_role;
GRANT ALL ON TABLE public.user_cosmetic_grants TO service_role;
GRANT ALL ON TABLE public.user_equipped_cosmetics TO service_role;
GRANT ALL ON TABLE public.entitlement_ledger TO service_role;

DROP POLICY IF EXISTS "Users read own entitlements" ON public.user_entitlements;
CREATE POLICY "Users read own entitlements" ON public.user_entitlements
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own cosmetic grants" ON public.user_cosmetic_grants;
CREATE POLICY "Users read own cosmetic grants" ON public.user_cosmetic_grants
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own equipped cosmetics" ON public.user_equipped_cosmetics;
CREATE POLICY "Users read own equipped cosmetics" ON public.user_equipped_cosmetics
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own entitlement ledger" ON public.entitlement_ledger;
CREATE POLICY "Users read own entitlement ledger" ON public.entitlement_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- A server-side writer may only equip a currently valid grant of the same
-- family. Expired temporary items can remain stored for audit, but cannot be
-- newly equipped.
CREATE OR REPLACE FUNCTION public.assert_equipped_cosmetic_grant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_cosmetic_grants AS grant
    WHERE grant.user_id = NEW.user_id
      AND grant.cosmetic_key = NEW.cosmetic_key
      AND grant.cosmetic_family = NEW.cosmetic_family
      AND (grant.permanent IS TRUE OR grant.valid_until > now())
  ) THEN
    RAISE EXCEPTION 'Cannot equip a missing or expired cosmetic grant';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_equipped_cosmetic_grant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_equipped_cosmetics_require_active_grant ON public.user_equipped_cosmetics;
CREATE TRIGGER user_equipped_cosmetics_require_active_grant
  BEFORE INSERT OR UPDATE ON public.user_equipped_cosmetics
  FOR EACH ROW EXECUTE FUNCTION public.assert_equipped_cosmetic_grant();
