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
