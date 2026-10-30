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
DROP POLICY IF EXISTS "Users read their purchase payment reviews" ON public.purchase_payment_reviews;
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
END; $$;

REVOKE ALL ON FUNCTION public.begin_payment_webhook_event(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_payment_webhook_event(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_purchase_payment_review(text, text, text, bigint, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_payment_webhook_event(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_payment_webhook_event(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_purchase_payment_review(text, text, text, bigint, integer) TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.user_purchases FROM anon, authenticated;
DROP POLICY IF EXISTS "Users create own purchases" ON public.user_purchases;
REVOKE ALL ON FUNCTION public.fulfill_store_purchase(uuid, text, text, integer, integer, integer, integer, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_store_purchase(uuid, text, text, integer, integer, integer, integer, text[]) TO service_role;

ALTER TABLE public.checkout_session_owners
  ADD COLUMN IF NOT EXISTS product_key text,
  ADD COLUMN IF NOT EXISTS price_cents integer,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS contents_snapshot jsonb;
ALTER TABLE public.checkout_session_owners DROP CONSTRAINT IF EXISTS checkout_offer_snapshot_complete;
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
DROP TRIGGER IF EXISTS protect_checkout_offer_snapshot ON public.checkout_session_owners;
CREATE TRIGGER protect_checkout_offer_snapshot BEFORE UPDATE ON public.checkout_session_owners
FOR EACH ROW EXECUTE FUNCTION public.protect_checkout_offer_snapshot();

CREATE OR REPLACE FUNCTION public.reconcile_subscription_wallet(_user_id uuid, _environment text)
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
REVOKE ALL ON FUNCTION public.reconcile_subscription_wallet(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_subscription_wallet(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';