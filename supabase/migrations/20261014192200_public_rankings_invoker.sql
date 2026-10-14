-- Expose only opted-in leaderboard columns through RLS, without an elevated anonymous function.
-- Rollback: ALTER FUNCTION public.get_public_activity_rankings(integer) SECURITY DEFINER;
--            REVOKE SELECT (public_name, club_id, weekly_active_seconds, matches_completed,
--              wins, active_streak, opted_in, updated_at) ON public.activity_rankings FROM anon, authenticated;
-- Note: EXECUTE on the existing public RPC is intentionally preserved.
BEGIN;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.activity_rankings FROM anon;
GRANT SELECT (public_name, club_id, weekly_active_seconds,
  matches_completed, wins, active_streak, opted_in, updated_at)
  ON TABLE public.activity_rankings TO anon, authenticated;
ALTER FUNCTION public.get_public_activity_rankings(integer) SECURITY INVOKER;
ALTER FUNCTION public.get_public_activity_rankings(integer) SET search_path = '';
COMMIT;
