-- Cache the current authenticated user once per SQL statement in two
-- read-only owner policies. Identity matching and RLS grants are unchanged.
-- This is an application-owned forward migration, never a history rewrite.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER POLICY "Players read their own coin services"
  ON public.coin_service_spends
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Owners read their save chain"
  ON public.career_save_chain
  USING ((SELECT auth.uid()) = user_id);

COMMIT;
