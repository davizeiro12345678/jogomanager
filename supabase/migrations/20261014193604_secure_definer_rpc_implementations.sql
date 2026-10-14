-- Keep the narrowly scoped SECURITY DEFINER implementations outside schemas
-- exposed to PostgREST. Public RPC names remain SECURITY INVOKER wrappers.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;

ALTER FUNCTION public.get_own_activity_ranking() SET SCHEMA app_private;
ALTER FUNCTION public.get_public_activity_rankings(integer) SET SCHEMA app_private;
ALTER FUNCTION public.record_active_time(text, text, integer, integer, integer, integer) SET SCHEMA app_private;
ALTER FUNCTION public.redeem_game_coupon(text) SET SCHEMA app_private;
ALTER FUNCTION public.set_activity_ranking_preferences(boolean, text, text) SET SCHEMA app_private;

REVOKE ALL ON FUNCTION app_private.get_own_activity_ranking() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION app_private.get_public_activity_rankings(integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION app_private.record_active_time(text, text, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION app_private.redeem_game_coupon(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION app_private.set_activity_ranking_preferences(boolean, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- The wrappers run with the caller's privileges, so the inner functions need
-- execute permission for the same roles. app_private remains unexposed by API.
GRANT EXECUTE ON FUNCTION app_private.get_own_activity_ranking() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.get_public_activity_rankings(integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.record_active_time(text, text, integer, integer, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.redeem_game_coupon(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.set_activity_ranking_preferences(boolean, text, text) TO authenticated, service_role;

CREATE FUNCTION public.get_own_activity_ranking()
RETURNS TABLE(
  public_name text,
  club_id text,
  active_seconds bigint,
  weekly_active_seconds bigint,
  matches_completed integer,
  wins integer,
  active_streak integer,
  opted_in boolean
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT * FROM app_private.get_own_activity_ranking();
$function$;

CREATE FUNCTION public.get_public_activity_rankings(p_limit integer DEFAULT 20)
RETURNS TABLE(
  rank bigint,
  public_name text,
  club_id text,
  weekly_active_seconds bigint,
  matches_completed integer,
  wins integer,
  active_streak integer
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT * FROM app_private.get_public_activity_rankings(p_limit);
$function$;

CREATE FUNCTION public.record_active_time(
  p_public_name text,
  p_club_id text,
  p_matches_started integer DEFAULT 0,
  p_matches_completed integer DEFAULT 0,
  p_wins integer DEFAULT 0,
  p_seasons integer DEFAULT 0
)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT app_private.record_active_time(
    p_public_name, p_club_id, p_matches_started, p_matches_completed, p_wins, p_seasons
  );
$function$;

CREATE FUNCTION public.redeem_game_coupon(_code text)
RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT app_private.redeem_game_coupon(_code);
$function$;

CREATE FUNCTION public.set_activity_ranking_preferences(
  p_opted_in boolean,
  p_public_name text,
  p_club_id text
)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT app_private.set_activity_ranking_preferences(p_opted_in, p_public_name, p_club_id);
$function$;

REVOKE ALL ON FUNCTION public.get_own_activity_ranking() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_public_activity_rankings(integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_active_time(text, text, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.redeem_game_coupon(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_activity_ranking_preferences(boolean, text, text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_own_activity_ranking() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_activity_rankings(integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_active_time(text, text, integer, integer, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_game_coupon(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_activity_ranking_preferences(boolean, text, text) TO authenticated, service_role;
