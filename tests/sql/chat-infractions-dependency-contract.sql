\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $contract$
BEGIN
  IF to_regclass('public.chat_infractions') IS NULL THEN
    RAISE EXCEPTION 'required moderation table absent';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'chat_infractions'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'moderation history must enforce row-level security';
  END IF;
  IF has_table_privilege('anon', 'public.chat_infractions', 'SELECT')
    OR has_table_privilege('anon', 'public.chat_infractions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.chat_infractions', 'INSERT')
    OR NOT has_table_privilege('authenticated', 'public.chat_infractions', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.chat_infractions', 'INSERT')
  THEN RAISE EXCEPTION 'moderation grants are too broad or service role is broken'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_infractions'
      AND policyname = 'Users read their own chat infractions'
      AND cmd = 'SELECT'
      AND 'authenticated' = ANY(roles)
  ) THEN
    RAISE EXCEPTION 'moderation user-read RLS policy absent';
  END IF;
END $contract$;

SET LOCAL ROLE service_role;
INSERT INTO public.chat_infractions(user_id, reason)
VALUES ('00000000-0000-4000-8000-000000000091', 'repeated');
RESET ROLE;
ROLLBACK;
