-- Optimize a per-row auth.uid() evaluation while preserving the ownership condition.
-- The production policy was inspected on 2026-11-27 before this migration.
-- Do not broaden access: only authenticated users may read their own rows.
ALTER POLICY "Players read their own coin services"
ON public.coin_service_spends
TO authenticated
USING ((SELECT auth.uid()) = user_id);
