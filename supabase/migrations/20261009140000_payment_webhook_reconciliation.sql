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
    WHERE p.reference = purchase_payment_reviews.reference AND p.user_id = auth.uid()
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
