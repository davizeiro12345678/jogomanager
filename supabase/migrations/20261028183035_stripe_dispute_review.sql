-- Disputes are recorded for review. No wallet or entitlement is revoked here.
CREATE TABLE public.purchase_dispute_reviews (
  dispute_id text PRIMARY KEY CHECK (char_length(dispute_id) BETWEEN 3 AND 128),
  reference text NOT NULL CHECK (char_length(reference) BETWEEN 3 AND 128),
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  status text NOT NULL CHECK (status ~ '^[a-z_]{1,64}$'),
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
  event_id text NOT NULL CHECK (char_length(event_id) BETWEEN 3 AND 128),
  event_created bigint NOT NULL CHECK (event_created >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX purchase_dispute_reviews_reference_idx ON public.purchase_dispute_reviews (reference);
ALTER TABLE public.purchase_dispute_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.purchase_dispute_reviews FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.purchase_dispute_reviews TO service_role;

CREATE FUNCTION public.reconcile_purchase_dispute(
  _dispute_id text, _reference text, _environment text, _status text,
  _amount_cents bigint, _currency text, _event_id text, _event_created bigint
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('purchase-dispute:' || _dispute_id, 0));
  IF EXISTS (SELECT 1 FROM public.purchase_dispute_reviews WHERE dispute_id = _dispute_id
    AND (reference <> _reference OR environment <> _environment)) THEN
    RAISE EXCEPTION 'dispute_reference_mismatch';
  END IF;
  -- A connected Stripe account may also serve other products. Only retain
  -- disputes for a checkout that this application registered in this mode.
  IF NOT EXISTS (SELECT 1 FROM public.checkout_session_owners
    WHERE session_id = _reference AND environment = _environment)
    AND NOT EXISTS (SELECT 1 FROM public.guest_checkout_intents
      WHERE stripe_session_id = _reference AND environment = _environment) THEN
    RETURN;
  END IF;
  INSERT INTO public.purchase_dispute_reviews
    (dispute_id, reference, environment, status, amount_cents, currency, event_id, event_created)
  VALUES (_dispute_id, _reference, _environment, _status, _amount_cents, _currency, _event_id, _event_created)
  ON CONFLICT (dispute_id) DO UPDATE SET
    status = EXCLUDED.status, amount_cents = EXCLUDED.amount_cents, currency = EXCLUDED.currency,
    event_id = EXCLUDED.event_id, event_created = EXCLUDED.event_created, updated_at = now()
  WHERE EXCLUDED.event_created >= purchase_dispute_reviews.event_created;
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_purchase_dispute(text,text,text,text,bigint,text,text,bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_purchase_dispute(text,text,text,text,bigint,text,text,bigint)
  TO service_role;
