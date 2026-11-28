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
  IF to_regclass('public.career_save_chain') IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'careers'
        AND column_name = 'chain_hash'
    )
    OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'careers'
        AND column_name = 'chain_length'
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = to_regclass('public.careers')
        AND tgname = 'careers_link_save' AND NOT tgisinternal
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname = 'link_career_save'
    ) THEN
    RAISE EXCEPTION 'Drizzle 0053 career save chain prerequisites are missing';
  END IF;
  IF matched_policies <> 2 THEN
    RAISE EXCEPTION 'Drizzle 0088 RLS contract incomplete: % of 2 owner policies',
      matched_policies;
  END IF;
END;
$audit$;
ROLLBACK;
