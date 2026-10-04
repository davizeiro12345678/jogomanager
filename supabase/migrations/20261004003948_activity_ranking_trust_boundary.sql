-- Preserve the existing RPC signature for older clients, but do not trust
-- career counters supplied by the browser. Only elapsed server time is stored.
CREATE OR REPLACE FUNCTION public.record_active_time(
  p_public_name text,
  p_club_id text,
  p_matches_started integer DEFAULT 0,
  p_matches_completed integer DEFAULT 0,
  p_wins integer DEFAULT 0,
  p_seasons integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_week date := date_trunc('week', now() AT TIME ZONE 'UTC')::date;
  v_previous public.activity_rankings%ROWTYPE;
  v_delta integer := 0;
  v_streak integer := 1;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_previous
  FROM public.activity_rankings
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_previous.last_heartbeat_at IS NOT NULL THEN
      v_delta := LEAST(
        75,
        GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_previous.last_heartbeat_at))::integer)
      );
    END IF;

    IF v_previous.last_active_date = v_today THEN
      v_streak := v_previous.active_streak;
    ELSIF v_previous.last_active_date = v_today - 1 THEN
      v_streak := v_previous.active_streak + 1;
    END IF;
  END IF;

  INSERT INTO public.activity_rankings (
    user_id,
    public_name,
    club_id,
    active_streak,
    week_key,
    last_active_date,
    last_heartbeat_at,
    updated_at
  )
  VALUES (
    v_user_id,
    LEFT(TRIM(COALESCE(NULLIF(p_public_name, ''), 'Treinador')), 28),
    LEFT(p_club_id, 80),
    v_streak,
    v_week,
    v_today,
    v_now,
    v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    public_name = LEFT(
      TRIM(COALESCE(NULLIF(EXCLUDED.public_name, ''), activity_rankings.public_name)),
      28
    ),
    club_id = EXCLUDED.club_id,
    active_seconds = activity_rankings.active_seconds + v_delta,
    weekly_active_seconds = CASE
      WHEN activity_rankings.week_key = v_week
        THEN activity_rankings.weekly_active_seconds + v_delta
      ELSE v_delta
    END,
    active_streak = v_streak,
    week_key = v_week,
    last_active_date = v_today,
    last_heartbeat_at = v_now,
    updated_at = v_now;
END;
$function$;

-- Keep the existing result shape for deployed clients, but mask counters that
-- were previously accepted from untrusted career saves. Activity time remains
-- the only public ranking score.
CREATE OR REPLACE FUNCTION public.get_public_activity_rankings(p_limit integer DEFAULT 20)
RETURNS TABLE(
  rank bigint,
  public_name text,
  club_id text,
  weekly_active_seconds bigint,
  matches_completed integer,
  wins integer,
  active_streak integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    row_number() OVER (ORDER BY weekly_active_seconds DESC, updated_at ASC),
    public_name,
    club_id,
    weekly_active_seconds,
    0::integer AS matches_completed,
    0::integer AS wins,
    active_streak
  FROM public.activity_rankings
  WHERE opted_in = true
  ORDER BY weekly_active_seconds DESC, updated_at ASC
  LIMIT LEAST(100, GREATEST(1, p_limit));
$function$;

CREATE OR REPLACE FUNCTION public.get_own_activity_ranking()
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public_name,
    club_id,
    active_seconds,
    weekly_active_seconds,
    0::integer AS matches_completed,
    0::integer AS wins,
    active_streak,
    opted_in
  FROM public.activity_rankings
  WHERE user_id = auth.uid();
$function$;
