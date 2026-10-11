REVOKE EXECUTE ON FUNCTION public.fulfill_store_purchase(uuid,text,text,integer,integer,integer,integer,text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_guest_checkout_attempt(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_guest_checkout_claim(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_own_activity_ranking() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_active_time(text,text,integer,integer,integer,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_activity_ranking_preferences(boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fulfill_store_purchase(uuid,text,text,integer,integer,integer,integer,text[]), public.reserve_guest_checkout_attempt(text), public.reserve_guest_checkout_claim(uuid,uuid) TO service_role;

CREATE INDEX IF NOT EXISTS clubs_stadium_idx ON public.clubs(stadium_id);
CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS chat_reports_reporter_idx ON public.chat_reports(reporter_id);
CREATE INDEX IF NOT EXISTS official_leagues_local_comp_idx ON public.official_leagues(local_competition_id);
CREATE INDEX IF NOT EXISTS official_teams_local_club_idx ON public.official_teams(local_club_id);
CREATE INDEX IF NOT EXISTS competition_seasons_champion_idx ON public.competition_seasons(champion_club_id);
CREATE INDEX IF NOT EXISTS competition_seasons_runner_up_idx ON public.competition_seasons(runner_up_club_id);
CREATE INDEX IF NOT EXISTS player_season_stats_club_idx ON public.player_season_stats(club_id);
CREATE INDEX IF NOT EXISTS player_season_stats_comp_idx ON public.player_season_stats(competition_id);
CREATE INDEX IF NOT EXISTS guest_checkout_intents_product_idx ON public.guest_checkout_intents(product_key);
CREATE INDEX IF NOT EXISTS guest_checkout_intents_claimed_idx ON public.guest_checkout_intents(claimed_by_user_id);
CREATE INDEX IF NOT EXISTS coupon_redemptions_code_idx ON public.coupon_redemptions(code);

DO $$
DECLARE r record; q text; w text; s text;
BEGIN
  FOR r IN SELECT * FROM pg_policies WHERE schemaname='public'
    AND (coalesce(qual,'') ~ 'auth\.uid\(\)' OR coalesce(with_check,'') ~ 'auth\.uid\(\)') LOOP
    q := replace(r.qual, 'auth.uid()', '(SELECT auth.uid())');
    w := replace(r.with_check, 'auth.uid()', '(SELECT auth.uid())');
    s := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF q IS NOT NULL THEN s := s || format(' USING (%s)', q); END IF;
    IF w IS NOT NULL THEN s := s || format(' WITH CHECK (%s)', w); END IF;
    EXECUTE s;
  END LOOP;
END $$;