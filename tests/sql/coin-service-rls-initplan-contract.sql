-- Inspect both policies installed by canonical Drizzle migration 0088.
-- Run only in an isolated staging database. No financial records are read.
-- Production currently lacks public.career_save_chain: applying migration 0088
-- directly in that environment before reconciling the history would fail.
BEGIN;
DO $audit$
DECLARE matched_policies integer;
BEGIN
  SELECT COUNT(*) INTO matched_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd = 'SELECT'
    AND roles @> ARRAY['authenticated']::name[]
    AND (
      (tablename = 'coin_service_spends'
        AND policyname = 'Players read their own coin services')
      OR
      (tablename = 'career_save_chain'
        AND policyname = 'Owners read their save chain')
    )
    AND qual LIKE '%SELECT auth.uid()%'
    AND qual LIKE '%user_id%';
  IF matched_policies <> 2 THEN
    RAISE EXCEPTION 'Drizzle 0088 RLS contract incomplete: % of 2 owner policies',
      matched_policies;
  END IF;
END;
$audit$;
ROLLBACK;
