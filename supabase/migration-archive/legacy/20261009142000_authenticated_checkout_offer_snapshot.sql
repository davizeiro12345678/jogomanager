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
