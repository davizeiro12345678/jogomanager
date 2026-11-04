-- A distributed, service-only limit for the authenticated test notification.
CREATE TABLE IF NOT EXISTS public.firebase_push_test_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_attempt_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.firebase_push_test_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.firebase_push_test_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.firebase_push_test_limits TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_firebase_push_test(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE allowed boolean;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.firebase_push_test_limits AS limits (user_id, last_attempt_at)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET last_attempt_at = now()
    WHERE limits.last_attempt_at < now() - interval '1 hour'
  RETURNING true INTO allowed;
  RETURN COALESCE(allowed, false);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_firebase_push_test(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_firebase_push_test(uuid) TO service_role;
