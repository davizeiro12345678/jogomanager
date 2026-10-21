DO $do$
BEGIN
  IF to_regclass('public.match_room_secrets') IS NULL THEN
    RAISE EXCEPTION 'Expected secret table is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='match_room_secrets' AND policyname='Deny browser access to room seeds'
  ) THEN
    CREATE POLICY "Deny browser access to room seeds"
      ON public.match_room_secrets
      AS RESTRICTIVE FOR ALL TO anon, authenticated
      USING (false) WITH CHECK (false);
  END IF;
END $do$;
REVOKE ALL ON TABLE public.match_room_secrets FROM anon, authenticated;
