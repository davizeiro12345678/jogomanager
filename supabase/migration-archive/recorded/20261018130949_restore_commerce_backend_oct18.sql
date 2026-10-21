-- Source: supabase/migrations/20261009140000_payment_webhook_reconciliation.sql
-- PREPARED ONLY. Apply through the deployment migration process before the
-- webhook code is released. Refund policy: record for review, retain benefits.
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  event_id text PRIMARY KEY CHECK (char_length(event_id) BETWEEN 1 AND 120),
  event_type text NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'retry', 'completed')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_webhook_events TO service_role;

-- No FK to purchases: a refund can arrive before checkout.session.completed.
CREATE TABLE IF NOT EXISTS public.purchase_payment_reviews (
  reference text PRIMARY KEY CHECK (char_length(reference) BETWEEN 1 AND 200),
  review_status text NOT NULL CHECK (review_status IN ('payment_failed', 'refund_review')),
  refunded_amount_cents integer NOT NULL DEFAULT 0 CHECK (refunded_amount_cents >= 0),
  event_created bigint NOT NULL CHECK (event_created >= 0),
  event_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_payment_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.purchase_payment_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.purchase_payment_reviews TO authenticated;
GRANT ALL ON public.purchase_payment_reviews TO service_role;
CREATE POLICY "Users read their purchase payment reviews" ON public.purchase_payment_reviews
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.user_purchases p
    WHERE p.reference = purchase_payment_reviews.reference AND p.user_id = (select auth.uid())
  ));

CREATE OR REPLACE FUNCTION public.begin_payment_webhook_event(_event_id text, _event_type text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_status text;
BEGIN
  IF _event_id IS NULL OR _event_type IS NULL THEN RAISE EXCEPTION 'Invalid payment event'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('payment-event:' || _event_id, 0));
  SELECT status INTO current_status FROM public.payment_webhook_events WHERE event_id = _event_id;
  IF current_status = 'completed' THEN RETURN false; END IF;
  INSERT INTO public.payment_webhook_events(event_id, event_type)
  VALUES (_event_id, _event_type)
  ON CONFLICT (event_id) DO UPDATE SET attempts = payment_webhook_events.attempts + 1,
    status = 'processing', updated_at = now();
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.finish_payment_webhook_event(_event_id text, _succeeded boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- A slower failing duplicate must never overwrite a completed delivery.
  UPDATE public.payment_webhook_events
  SET status = CASE WHEN _succeeded THEN 'completed' ELSE 'retry' END, updated_at = now()
  WHERE event_id = _event_id AND status <> 'completed';
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.payment_webhook_events WHERE event_id = _event_id) THEN
    RAISE EXCEPTION 'Payment event not registered';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.reconcile_purchase_payment_review(
  _event_id text, _reference text, _event_type text,
  _event_created bigint, _refunded_amount_cents integer DEFAULT 0
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF _event_type NOT IN ('charge.refunded', 'payment_intent.payment_failed')
    OR _reference IS NULL OR _event_created IS NULL OR _event_created < 0
    OR _refunded_amount_cents IS NULL OR _refunded_amount_cents < 0 THEN
    RAISE EXCEPTION 'Invalid payment review';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('payment-review:' || _reference, 0));
  INSERT INTO public.purchase_payment_reviews(reference, review_status, refunded_amount_cents, event_created, event_id)
  VALUES (_reference, CASE WHEN _event_type = 'charge.refunded' THEN 'refund_review' ELSE 'payment_failed' END,
    _refunded_amount_cents, _event_created, _event_id)
  ON CONFLICT (reference) DO UPDATE SET
    review_status = CASE WHEN EXCLUDED.review_status = 'refund_review' OR purchase_payment_reviews.review_status = 'refund_review'
      THEN 'refund_review' ELSE 'payment_failed' END,
    refunded_amount_cents = GREATEST(purchase_payment_reviews.refunded_amount_cents, EXCLUDED.refunded_amount_cents),
    event_created = GREATEST(purchase_payment_reviews.event_created, EXCLUDED.event_created),
    event_id = CASE WHEN EXCLUDED.event_created >= purchase_payment_reviews.event_created THEN EXCLUDED.event_id ELSE purchase_payment_reviews.event_id END,
    updated_at = now();
  IF _event_type = 'payment_intent.payment_failed' THEN
    UPDATE public.user_purchases SET status = 'failed', error = 'Pagamento não foi concluído'
    WHERE reference = _reference AND status <> 'completed';
  END IF;
  -- A refund neither mutates completed status nor debits the user's wallet.
END; $$;

REVOKE ALL ON FUNCTION public.begin_payment_webhook_event(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_payment_webhook_event(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_purchase_payment_review(text, text, text, bigint, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_payment_webhook_event(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_payment_webhook_event(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_purchase_payment_review(text, text, text, bigint, integer) TO service_role;

-- Purchase delivery is server-owned. Authenticated clients keep read access.
REVOKE INSERT, UPDATE, DELETE ON public.user_purchases FROM anon, authenticated;
DROP POLICY IF EXISTS "Users create own purchases" ON public.user_purchases;
REVOKE ALL ON FUNCTION public.fulfill_store_purchase(uuid, text, text, integer, integer, integer, integer, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_store_purchase(uuid, text, text, integer, integer, integer, integer, text[]) TO service_role;


-- Source: supabase/migrations/20261009142000_authenticated_checkout_offer_snapshot.sql
-- PREPARED ONLY. Preserve the existing ownership table and freeze the offer
-- before the checkout's client secret is exposed to the authenticated buyer.
CREATE TABLE IF NOT EXISTS public.checkout_session_owners (
  session_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  environment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checkout_session_owners
  ADD COLUMN IF NOT EXISTS product_key text,
  ADD COLUMN IF NOT EXISTS price_cents integer,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS contents_snapshot jsonb;
ALTER TABLE public.checkout_session_owners ADD CONSTRAINT checkout_offer_snapshot_complete CHECK (
  (product_key IS NULL AND price_cents IS NULL AND currency IS NULL AND stripe_price_id IS NULL AND contents_snapshot IS NULL)
  OR (product_key IS NOT NULL AND price_cents IS NOT NULL AND price_cents >= 0
    AND currency IS NOT NULL AND currency ~ '^[A-Za-z]{3}$'
    AND stripe_price_id IS NOT NULL AND contents_snapshot IS NOT NULL AND jsonb_typeof(contents_snapshot) = 'object')
);
ALTER TABLE public.checkout_session_owners ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_session_owners FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.checkout_session_owners TO service_role;
CREATE INDEX IF NOT EXISTS checkout_session_owners_user_idx ON public.checkout_session_owners(user_id);

CREATE OR REPLACE FUNCTION public.protect_checkout_offer_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF ROW(NEW.session_id, NEW.user_id, NEW.environment)
    IS DISTINCT FROM ROW(OLD.session_id, OLD.user_id, OLD.environment)
    OR (OLD.contents_snapshot IS NOT NULL AND ROW(NEW.product_key, NEW.price_cents, NEW.currency, NEW.stripe_price_id, NEW.contents_snapshot)
      IS DISTINCT FROM ROW(OLD.product_key, OLD.price_cents, OLD.currency, OLD.stripe_price_id, OLD.contents_snapshot))
  THEN RAISE EXCEPTION 'Checkout ownership and paid offer are immutable'; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.protect_checkout_offer_snapshot() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_checkout_offer_snapshot BEFORE UPDATE ON public.checkout_session_owners
FOR EACH ROW EXECUTE FUNCTION public.protect_checkout_offer_snapshot();
-- Existing rows are deliberately not backfilled with the current catalog:
-- their original contents cannot be reconstructed from mutable SKU data.
-- A service operator may fill a legacy row once from an independently verified
-- original offer; after that, the same immutability guard applies.


-- Source: supabase/migrations/20261009143000_vip_entitlements_and_cosmetics.sql
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
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users read own cosmetic grants" ON public.user_cosmetic_grants;
CREATE POLICY "Users read own cosmetic grants" ON public.user_cosmetic_grants
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users read own equipped cosmetics" ON public.user_equipped_cosmetics;
CREATE POLICY "Users read own equipped cosmetics" ON public.user_equipped_cosmetics
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users read own entitlement ledger" ON public.entitlement_ledger;
CREATE POLICY "Users read own entitlement ledger" ON public.entitlement_ledger
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

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
    FROM public.user_cosmetic_grants AS owned_grant
    WHERE owned_grant.user_id = NEW.user_id
      AND owned_grant.cosmetic_key = NEW.cosmetic_key
      AND owned_grant.cosmetic_family = NEW.cosmetic_family
      AND (owned_grant.permanent IS TRUE OR owned_grant.valid_until > now())
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


-- Source: supabase/migrations/20261009144000_subscription_wallet_reconciliation.sql
-- Rebuild the pass flag from every subscription for an account/environment.
-- Webhooks can arrive out of order; writing directly from one event can clear
-- an overlapping valid subscription. This function preserves all non-pass
-- wallet values and changes only the derived pass fields.
CREATE OR REPLACE FUNCTION public.reconcile_subscription_wallet(
  _user_id uuid,
  _environment text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pass_until timestamptz;
BEGIN
  IF _user_id IS NULL OR char_length(btrim(COALESCE(_environment, ''))) = 0 THEN
    RAISE EXCEPTION 'invalid subscription wallet reconciliation input';
  END IF;

  SELECT max(subscription.current_period_end)
  INTO pass_until
  FROM public.subscriptions AS subscription
  WHERE subscription.user_id = _user_id
    AND subscription.environment = _environment
    AND subscription.current_period_end > now()
    AND subscription.status IN ('active', 'trialing', 'canceled');

  INSERT INTO public.user_wallet (user_id, season_pass, season_pass_until)
  VALUES (_user_id, pass_until IS NOT NULL, pass_until)
  ON CONFLICT (user_id) DO UPDATE
  SET season_pass = EXCLUDED.season_pass,
      season_pass_until = EXCLUDED.season_pass_until,
      updated_at = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_subscription_wallet(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_subscription_wallet(uuid, text) TO service_role;


-- Source: supabase/migrations/20261009145000_tech_telemetry_rate_limit.sql
-- Telemetry has no account login by design, so admission must happen before a
-- service-role insert. Store only a salted address hash, never the address.
CREATE TABLE IF NOT EXISTS public.tech_telemetry_rate_limits (
  bucket text PRIMARY KEY CHECK (bucket ~ '^tech-v1:[a-f0-9]{64}$'),
  window_started_at timestamptz NOT NULL,
  accepted integer NOT NULL DEFAULT 0 CHECK (accepted >= 0 AND accepted <= 7),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tech_telemetry_rate_limits_window_idx
  ON public.tech_telemetry_rate_limits (window_started_at);

ALTER TABLE public.tech_telemetry_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tech_telemetry_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.tech_telemetry_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_tech_telemetry_slot(_bucket text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_window timestamptz := date_trunc('minute', now());
  accepted_now integer;
BEGIN
  IF _bucket IS NULL OR _bucket !~ '^tech-v1:[a-f0-9]{64}$' THEN
    RETURN false;
  END IF;

  -- Bounded retention avoids turning anonymous traffic into a durable address
  -- catalogue. The index keeps this maintenance small on each admission.
  DELETE FROM public.tech_telemetry_rate_limits
  WHERE window_started_at < current_window - interval '2 hours';

  INSERT INTO public.tech_telemetry_rate_limits AS rate_limit (
    bucket, window_started_at, accepted, updated_at
  )
  VALUES (_bucket, current_window, 1, now())
  ON CONFLICT (bucket) DO UPDATE
  SET window_started_at = EXCLUDED.window_started_at,
      accepted = CASE
        WHEN rate_limit.window_started_at = EXCLUDED.window_started_at
          THEN LEAST(rate_limit.accepted + 1, 7)
        ELSE 1
      END,
      updated_at = now()
  RETURNING accepted INTO accepted_now;

  -- Six observations per minute per pseudonymous origin is enough for a
  -- single diagnostics page while limiting unauthenticated write amplification.
  RETURN accepted_now <= 6;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_tech_telemetry_slot(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tech_telemetry_slot(text) TO service_role;
