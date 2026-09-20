CREATE TABLE public.activity_rankings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  public_name text NOT NULL DEFAULT 'Treinador',
  club_id text,
  opted_in boolean NOT NULL DEFAULT false,
  active_seconds bigint NOT NULL DEFAULT 0 CHECK (active_seconds >= 0),
  weekly_active_seconds bigint NOT NULL DEFAULT 0 CHECK (weekly_active_seconds >= 0),
  matches_started integer NOT NULL DEFAULT 0 CHECK (matches_started >= 0),
  matches_completed integer NOT NULL DEFAULT 0 CHECK (matches_completed >= 0),
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  seasons integer NOT NULL DEFAULT 0 CHECK (seasons >= 0),
  active_streak integer NOT NULL DEFAULT 0 CHECK (active_streak >= 0),
  week_key date NOT NULL DEFAULT date_trunc('week', timezone('utc', now()))::date,
  last_active_date date,
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(public_name) BETWEEN 2 AND 28)
);

GRANT SELECT ON public.activity_rankings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.activity_rankings TO authenticated;
GRANT ALL ON public.activity_rankings TO service_role;

ALTER TABLE public.activity_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read opted in rankings"
ON public.activity_rankings FOR SELECT
TO anon, authenticated
USING (opted_in OR auth.uid() = user_id);

CREATE POLICY "Users can create own activity row"
ON public.activity_rankings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activity row"
ON public.activity_rankings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX activity_rankings_weekly_idx
ON public.activity_rankings (weekly_active_seconds DESC)
WHERE opted_in;

CREATE INDEX activity_rankings_total_idx
ON public.activity_rankings (active_seconds DESC)
WHERE opted_in;

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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_previous
  FROM public.activity_rankings
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_previous.last_heartbeat_at IS NOT NULL THEN
      v_delta := LEAST(90, GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_previous.last_heartbeat_at))::integer));
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
    v_user_id, LEFT(TRIM(COALESCE(NULLIF(p_public_name, ''), 'Treinador')), 28), p_club_id,
    0, 0, GREATEST(0, p_matches_started), GREATEST(0, p_matches_completed),
    GREATEST(0, p_wins), GREATEST(0, p_seasons), 1,
    v_week, v_today, v_now, v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    public_name = LEFT(TRIM(COALESCE(NULLIF(EXCLUDED.public_name, ''), activity_rankings.public_name)), 28),
    club_id = EXCLUDED.club_id,
    active_seconds = activity_rankings.active_seconds + v_delta,
    weekly_active_seconds = CASE
      WHEN activity_rankings.week_key = v_week THEN activity_rankings.weekly_active_seconds + v_delta
      ELSE v_delta
    END,
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

REVOKE ALL ON FUNCTION public.record_active_time(text, text, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_active_time(text, text, integer, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_active_time(text, text, integer, integer, integer, integer) TO service_role;