DROP POLICY IF EXISTS "Users manage own achievements" ON public.user_achievements;

CREATE POLICY "Users read own achievements"
  ON public.user_achievements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.user_achievements FROM authenticated;
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;

DROP POLICY IF EXISTS "Participants update the room" ON public.match_rooms;

CREATE POLICY "Participants update the room"
  ON public.match_rooms
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = host_id)
    OR (auth.uid() = guest_id)
    OR ((status = 'open'::text) AND (guest_id IS NULL))
  )
  WITH CHECK (
    ((auth.uid() = host_id) OR (auth.uid() = guest_id))
    AND (status <> 'done'::text OR state = '{}'::jsonb)
  );

GRANT ALL ON public.match_rooms TO service_role;