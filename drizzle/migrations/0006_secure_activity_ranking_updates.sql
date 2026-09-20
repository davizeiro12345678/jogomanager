REVOKE INSERT, UPDATE ON public.activity_rankings FROM authenticated;

DROP POLICY IF EXISTS "Users can create own activity row" ON public.activity_rankings;
DROP POLICY IF EXISTS "Users can update own activity row" ON public.activity_rankings;

CREATE OR REPLACE FUNCTION public.set_activity_ranking_preferences(
  p_opted_in boolean,
  p_public_name text,
  p_club_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text := LEFT(TRIM(COALESCE(NULLIF(p_public_name, ''), 'Treinador')), 28);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'Public name is too short';
  END IF;
  INSERT INTO public.activity_rankings (user_id, public_name, club_id, opted_in)
  VALUES (v_user_id, v_name, LEFT(p_club_id, 80), p_opted_in)
  ON CONFLICT (user_id) DO UPDATE SET
    public_name = EXCLUDED.public_name,
    club_id = EXCLUDED.club_id,
    opted_in = EXCLUDED.opted_in,
    updated_at = timezone('utc', now());
END;
$$;

REVOKE ALL ON FUNCTION public.set_activity_ranking_preferences(boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_activity_ranking_preferences(boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_activity_ranking_preferences(boolean, text, text) TO service_role;

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
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_today date := timezone('utc', now())::date;
  v_week date := date_trunc('week', timezone('utc', now()))::date;
  v_previous public.activity_rankings%ROWTYPE;
  v_delta integer := 0;
  v_streak integer := 1;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_previous FROM public.activity_rankings WHERE user_id = v_user_id FOR UPDATE;
  IF FOUND THEN
    IF v_previous.last_heartbeat_at IS NOT NULL THEN
      v_delta := LEAST(75, GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_previous.last_heartbeat_at))::integer));
    END IF;
    IF v_previous.last_active_date = v_today THEN
      v_streak := v_previous.active_streak;
    ELSIF v_previous.last_active_date = v_today - 1 THEN
      v_streak := v_previous.active_streak + 1;
    END IF;
  END IF;

  INSERT INTO public.activity_rankings (
    user_id, public_name, club_id, active_seconds, weekly_active_seconds,
    matches_started, matches_completed, wins, seasons, active_streak,
    week_key, last_active_date, last_heartbeat_at, updated_at
  ) VALUES (
    v_user_id, LEFT(TRIM(COALESCE(NULLIF(p_public_name, ''), 'Treinador')), 28), LEFT(p_club_id, 80),
    0, 0, LEAST(100000, GREATEST(0, p_matches_started)),
    LEAST(100000, GREATEST(0, p_matches_completed)), LEAST(100000, GREATEST(0, p_wins)),
    LEAST(1000, GREATEST(0, p_seasons)), 1, v_week, v_today, v_now, v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    public_name = LEFT(TRIM(COALESCE(NULLIF(EXCLUDED.public_name, ''), activity_rankings.public_name)), 28),
    club_id = EXCLUDED.club_id,
    active_seconds = activity_rankings.active_seconds + v_delta,
    weekly_active_seconds = CASE WHEN activity_rankings.week_key = v_week THEN activity_rankings.weekly_active_seconds + v_delta ELSE v_delta END,
    matches_started = GREATEST(activity_rankings.matches_started, EXCLUDED.matches_started),
    matches_completed = GREATEST(activity_rankings.matches_completed, EXCLUDED.matches_completed),
    wins = GREATEST(activity_rankings.wins, EXCLUDED.wins),
    seasons = GREATEST(activity_rankings.seasons, EXCLUDED.seasons),
    active_streak = v_streak,
    week_key = v_week,
    last_active_date = v_today,
    last_heartbeat_at = v_now,
    updated_at = v_now;
END;
$$;