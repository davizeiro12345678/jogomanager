CREATE OR REPLACE FUNCTION public.record_active_time(p_public_name text, p_club_id text, p_matches_started integer DEFAULT 0, p_matches_completed integer DEFAULT 0, p_wins integer DEFAULT 0, p_seasons integer DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
 v_user_id uuid := auth.uid();
 v_now timestamptz := now();
 v_today date := (now() AT TIME ZONE 'UTC')::date;
 v_week date := date_trunc('week', now() AT TIME ZONE 'UTC')::date;
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
  IF v_previous.last_active_date = v_today THEN v_streak := v_previous.active_streak;
  ELSIF v_previous.last_active_date = v_today - 1 THEN v_streak := v_previous.active_streak + 1;
  END IF;
 END IF;
 INSERT INTO public.activity_rankings (user_id, public_name, club_id, active_streak, week_key, last_active_date, last_heartbeat_at, updated_at)
 VALUES (v_user_id, LEFT(TRIM(COALESCE(NULLIF(p_public_name, ''), 'Treinador')), 28), LEFT(p_club_id, 80), v_streak, v_week, v_today, v_now, v_now)
 ON CONFLICT (user_id) DO UPDATE SET
  public_name = EXCLUDED.public_name, club_id = EXCLUDED.club_id,
  active_seconds = activity_rankings.active_seconds + v_delta,
  weekly_active_seconds = CASE WHEN activity_rankings.week_key = v_week THEN activity_rankings.weekly_active_seconds + v_delta ELSE v_delta END,
  active_streak = v_streak, week_key = v_week, last_active_date = v_today, last_heartbeat_at = v_now, updated_at = v_now;
END;
$function$;
REVOKE ALL ON FUNCTION public.record_active_time(text,text,integer,integer,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_active_time(text,text,integer,integer,integer,integer) TO authenticated, service_role;
COMMENT ON FUNCTION public.record_active_time(text,text,integer,integer,integer,integer) IS 'Heartbeat only. Legacy score arguments are deliberately ignored; durable results require server attestation.';