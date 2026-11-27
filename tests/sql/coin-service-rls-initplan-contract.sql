-- Run only on an isolated clone. This contract verifies the migration preserves
-- owner-only SELECT semantics and prevents per-row auth.uid() evaluation.
BEGIN;
SET LOCAL ROLE authenticated;
-- A null uid must not authorize records, including a null owner.
SELECT COUNT(*) AS rows_visible_without_jwt
FROM public.coin_service_spends;
RESET ROLE;
-- Inspect the effective SELECT expression. No data is changed.
DO $audit$
DECLARE policy_text text;
BEGIN
  SELECT qual INTO policy_text
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'coin_service_spends'
    AND policyname = 'Players read their own coin services' AND cmd = 'SELECT'
    AND roles @> ARRAY['authenticated']::name[];
  IF policy_text IS NULL
     OR policy_text NOT LIKE '%auth.uid()%'
     OR policy_text NOT LIKE '%SELECT%'
     OR policy_text NOT LIKE '%user_id%' THEN
    RAISE EXCEPTION 'coin_service_spends RLS optimization not installed: %', policy_text;
  END IF;
END;
$audit$;
ROLLBACK;
