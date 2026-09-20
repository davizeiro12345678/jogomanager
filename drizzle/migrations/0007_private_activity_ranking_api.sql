CREATE OR REPLACE FUNCTION public.get_public_activity_rankings(p_limit integer DEFAULT 20)
RETURNS TABLE (rank bigint, public_name text, club_id text, weekly_active_seconds bigint, matches_completed integer, wins integer, active_streak integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT row_number() OVER (ORDER BY weekly_active_seconds DESC, wins DESC, updated_at ASC), public_name, club_id,
    weekly_active_seconds, matches_completed, wins, active_streak
  FROM public.activity_rankings WHERE opted_in = true
  ORDER BY weekly_active_seconds DESC, wins DESC, updated_at ASC
  LIMIT LEAST(100, GREATEST(1, p_limit));
$$;
CREATE OR REPLACE FUNCTION public.get_own_activity_ranking()
RETURNS TABLE (public_name text, club_id text, active_seconds bigint, weekly_active_seconds bigint, matches_completed integer, wins integer, active_streak integer, opted_in boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public_name, club_id, active_seconds, weekly_active_seconds, matches_completed, wins, active_streak, opted_in
  FROM public.activity_rankings WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_public_activity_rankings(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_own_activity_ranking() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_activity_rankings(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_activity_ranking() TO authenticated;