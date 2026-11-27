-- Verify the existing Drizzle 0088 RLS migration on an isolated staging clone.
-- No mutation or table scan is needed to inspect the policy catalog.
-- If this fails on production, first deploy drizzle/migrations/0088_rls_cached_auth_context.sql via the standard release process; do not introduce a duplicate Supabase migration.
BEGIN;
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
