-- Apply after the original migrations. Explicit permissions override Supabase's
-- permissive default ACLs on newly created tables and SECURITY DEFINER functions.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT ON public.competitions, public.clubs, public.stadiums, public.kits,
  public.players, public.club_honours, public.competition_seasons,
  public.player_season_stats, public.player_honours, public.player_career_clubs,
  public.official_media, public.official_events, public.official_event_details,
  public.official_leagues, public.official_teams TO anon, authenticated;

GRANT SELECT (key, name, description, price_cents, currency, coins, kind, active,
  sale_percent_off, sale_starts_at, sale_ends_at)
  ON public.store_products TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.player_profiles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT SELECT, INSERT ON public.chat_reports TO authenticated;
GRANT SELECT, DELETE ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.match_rooms TO authenticated;
GRANT UPDATE (guest_id, guest_club, status, updated_at) ON public.match_rooms TO authenticated;
GRANT SELECT ON public.careers, public.user_achievements, public.user_purchases,
  public.user_wallet, public.subscriptions, public.wallet_item_log,
  public.user_boosts, public.coupon_redemptions TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_activity_rankings(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_activity_ranking() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_activity_ranking_preferences(boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_active_time(text, text, integer, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_game_coupon(text) TO authenticated;

-- Service-only tables are explicitly private. RLS also blocks ordinary roles.
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['club_external_ids', 'import_runs', 'game_coupons',
    'guest_checkout_intents', 'guest_checkout_rate_limits', 'tech_telemetry'] LOOP
    EXECUTE format('CREATE POLICY "Backend service only" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', table_name);
  END LOOP;
END $$;
