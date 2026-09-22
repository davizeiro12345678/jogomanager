-- Guest checkout owns an intent before a player has an authenticated account.
-- Catalog fields are defined by the following server-catalog migration. Each
-- intent takes its own private benefit snapshot so a later catalog edit cannot
-- change what a completed payment receives.
CREATE TABLE IF NOT EXISTS public.guest_checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_key text NOT NULL REFERENCES public.store_products(key),
  -- A deployment-secret hash only. The raw visitor email stays with Stripe and
  -- Supabase Auth and is never persisted in this table.
  email_hash text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  state text NOT NULL DEFAULT 'created'
    CHECK (state IN ('created', 'checkout_open', 'paid', 'claiming', 'claimed', 'expired', 'failed')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  contents_snapshot jsonb NOT NULL CHECK (
    jsonb_typeof(contents_snapshot) = 'object'
    AND jsonb_typeof(contents_snapshot -> 'coins') = 'number'
    AND COALESCE((contents_snapshot ->> 'coins') ~ '^[0-9]+$', false)
    AND jsonb_typeof(contents_snapshot -> 'scoutReports') = 'number'
    AND COALESCE((contents_snapshot ->> 'scoutReports') ~ '^[0-9]+$', false)
    AND jsonb_typeof(contents_snapshot -> 'trainingBoosts') = 'number'
    AND COALESCE((contents_snapshot ->> 'trainingBoosts') ~ '^[0-9]+$', false)
    AND jsonb_typeof(contents_snapshot -> 'themes') = 'array'
  ),
  stripe_price_id text,
  stripe_customer_id text,
  stripe_session_id text UNIQUE,
  open_key text UNIQUE,
  consent_version text NOT NULL,
  claimed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  expires_at timestamptz NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_checkout_intents_email_state_idx
  ON public.guest_checkout_intents(email_hash, state, expires_at DESC);
CREATE INDEX IF NOT EXISTS guest_checkout_intents_session_idx
  ON public.guest_checkout_intents(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

ALTER TABLE public.guest_checkout_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_checkout_intents FROM anon, authenticated;
GRANT ALL ON public.guest_checkout_intents TO service_role;

DROP TRIGGER IF EXISTS update_guest_checkout_intents_updated_at ON public.guest_checkout_intents;
CREATE TRIGGER update_guest_checkout_intents_updated_at
  BEFORE UPDATE ON public.guest_checkout_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- This service-only window prevents a repeated visitor click from opening an
-- unbounded number of Stripe sessions for the same email address.
CREATE TABLE IF NOT EXISTS public.guest_checkout_rate_limits (
  email_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.guest_checkout_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_checkout_rate_limits FROM anon, authenticated;
GRANT ALL ON public.guest_checkout_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_guest_checkout_attempt(_email_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean;
BEGIN
  IF char_length(_email_hash) <> 64 THEN
    RAISE EXCEPTION 'Invalid checkout rate key';
  END IF;

  INSERT INTO public.guest_checkout_rate_limits AS limits (email_hash, window_started_at, attempts, updated_at)
  VALUES (_email_hash, now(), 1, now())
  ON CONFLICT (email_hash) DO UPDATE
  SET
    attempts = CASE
      WHEN limits.window_started_at < now() - interval '15 minutes' THEN 1
      ELSE limits.attempts + 1
    END,
    window_started_at = CASE
      WHEN limits.window_started_at < now() - interval '15 minutes' THEN now()
      ELSE limits.window_started_at
    END,
    updated_at = now()
  WHERE limits.window_started_at < now() - interval '15 minutes'
     OR limits.attempts < 5
  RETURNING true INTO allowed;

  RETURN COALESCE(allowed, false);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_guest_checkout_attempt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_guest_checkout_attempt(text) TO service_role;

-- Claim ownership is a locked, service-only transition. Concurrent browser
-- tabs or two accounts cannot both attach a paid intent to their wallets.
CREATE OR REPLACE FUNCTION public.reserve_guest_checkout_claim(
  _intent_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_owner uuid;
  current_state text;
BEGIN
  SELECT claimed_by_user_id, state INTO current_owner, current_state
  FROM public.guest_checkout_intents
  WHERE id = _intent_id
  FOR UPDATE;

  IF NOT FOUND OR (current_owner IS NOT NULL AND current_owner <> _user_id) THEN
    RETURN false;
  END IF;

  IF current_state = 'claimed' THEN
    RETURN current_owner = _user_id;
  END IF;

  UPDATE public.guest_checkout_intents
  SET state = 'claiming', claimed_by_user_id = _user_id, error = NULL, updated_at = now()
  WHERE id = _intent_id
    AND state IN ('created', 'checkout_open', 'paid', 'claiming');

  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_guest_checkout_claim(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_guest_checkout_claim(uuid, uuid) TO service_role;
