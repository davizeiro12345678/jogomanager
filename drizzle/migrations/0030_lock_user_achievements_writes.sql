DROP POLICY IF EXISTS "Users insert own achievements" ON public.user_achievements;
REVOKE INSERT, UPDATE, DELETE ON public.user_achievements FROM anon, authenticated;
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;