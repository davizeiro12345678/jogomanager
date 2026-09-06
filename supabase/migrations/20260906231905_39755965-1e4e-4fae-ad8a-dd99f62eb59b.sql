CREATE OR REPLACE FUNCTION public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND (
        (status IN ('active', 'trialing') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO service_role;