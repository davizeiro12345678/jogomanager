-- A Checkout Session can be complete while an asynchronous method is still
-- settling. If it succeeds after the original 31-minute window, the signed
-- Stripe event still proves payment and the original intent must remain
-- claimable rather than silently losing the visitor's purchase.
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
    AND state IN ('created', 'checkout_open', 'paid', 'claiming', 'expired');

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_guest_checkout_claim(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_guest_checkout_claim(uuid, uuid) TO service_role;
