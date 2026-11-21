-- Forward repair for environments which received room-chat admission (0068)
-- without the historical standalone Drizzle 0041 chat infraction migration.
-- Never reset moderation history or turn off row-level security.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS public.chat_infractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL CHECK (
    reason IN ('profanity', 'link', 'contact', 'shouting', 'repeated')
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_infractions_user_time_idx
  ON public.chat_infractions (user_id, created_at DESC);
ALTER TABLE public.chat_infractions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_infractions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.chat_infractions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_infractions TO service_role;
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_infractions'
      AND policyname = 'Users read their own chat infractions'
  ) THEN
    CREATE POLICY "Users read their own chat infractions"
      ON public.chat_infractions FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END $policy$;
COMMENT ON TABLE public.chat_infractions IS
  'Server-recorded chat moderation infractions; user can read only their own.';
COMMIT;
