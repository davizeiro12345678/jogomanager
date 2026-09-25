ALTER TABLE public.careers ADD COLUMN verified_progress boolean NOT NULL DEFAULT false;
DROP POLICY IF EXISTS "Users manage their own career" ON public.careers;
CREATE POLICY "Users read their own career" ON public.careers FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.careers FROM authenticated;
GRANT SELECT ON public.careers TO authenticated;
GRANT ALL ON public.careers TO service_role;