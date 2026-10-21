-- Explicit transaction for Supabase CLI replay.
-- Recorded SQL: supabase/migration-archive/recorded/20261013190926_optimize_auth_uid_rls_initplans_oct_2026.sql
BEGIN;

-- Preservar a semantica RLS e calcular auth.uid() uma vez por comando.
SET LOCAL lock_timeout = '5s';
ALTER POLICY "Public can read opted in rankings" ON public."activity_rankings" USING ((opted_in OR ((select auth.uid()) = user_id)));
ALTER POLICY "Users read their own career" ON public."careers" USING (((select auth.uid()) = user_id));
ALTER POLICY "Signed in users read chat" ON public."chat_messages" USING (((hidden = false) AND (NOT (EXISTS ( SELECT 1
   FROM user_blocks b
  WHERE ((b.user_id = (select auth.uid())) AND (b.blocked_id = chat_messages.user_id)))))));
ALTER POLICY "Users delete own messages" ON public."chat_messages" USING (((select auth.uid()) = user_id));
ALTER POLICY "own reports insert" ON public."chat_reports" WITH CHECK (((select auth.uid()) = reporter_id));
ALTER POLICY "own reports read" ON public."chat_reports" USING (((select auth.uid()) = reporter_id));
ALTER POLICY "Users read own redemptions" ON public."coupon_redemptions" USING (((select auth.uid()) = user_id));
ALTER POLICY "Participants and open rooms are visible" ON public."match_rooms" USING (((status = 'open'::text) OR ((select auth.uid()) = host_id) OR ((select auth.uid()) = guest_id)));
ALTER POLICY "own profile insert" ON public."player_profiles" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "own profile read" ON public."player_profiles" USING (((select auth.uid()) = user_id));
ALTER POLICY "own profile update" ON public."player_profiles" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can create own profile" ON public."profiles" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own profile" ON public."profiles" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can read own profile" ON public."profiles" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own profile" ON public."profiles" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own subscription" ON public."subscriptions" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users read own achievements" ON public."user_achievements" USING (((select auth.uid()) = user_id));
ALTER POLICY "own blocks delete" ON public."user_blocks" USING (((select auth.uid()) = user_id));
ALTER POLICY "own blocks insert" ON public."user_blocks" WITH CHECK ((((select auth.uid()) = user_id) AND (blocked_id <> (select auth.uid()))));
ALTER POLICY "own blocks read" ON public."user_blocks" USING (((select auth.uid()) = user_id));
ALTER POLICY "own boost read" ON public."user_boosts" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users read own purchases" ON public."user_purchases" USING (((select auth.uid()) = user_id));
ALTER POLICY "Users read own wallet" ON public."user_wallet" USING (((select auth.uid()) = user_id));
ALTER POLICY "own item log read" ON public."wallet_item_log" USING (((select auth.uid()) = user_id));

COMMIT;
