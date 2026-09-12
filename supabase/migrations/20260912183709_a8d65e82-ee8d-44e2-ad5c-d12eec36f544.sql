REVOKE EXECUTE ON FUNCTION public.reserve_ai_budget(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_training_boost(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_budget(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_training_boost(uuid) TO service_role;

CREATE POLICY "service role manages ai budget" ON public.ai_budget_usage
  FOR ALL TO service_role USING (true) WITH CHECK (true);