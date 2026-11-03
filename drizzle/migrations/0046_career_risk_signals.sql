-- Server-recorded signals of implausible saves, for review; players never write them.
CREATE TABLE public.career_risk_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('goals', 'budget', 'trophies', 'match_pace', 'season_pace')),
  points integer NOT NULL CHECK (points > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX career_risk_signals_user_time ON public.career_risk_signals (user_id, created_at DESC);

GRANT ALL ON public.career_risk_signals TO service_role;
ALTER TABLE public.career_risk_signals ENABLE ROW LEVEL SECURITY;

-- Risk score over the last 30 days; callable only by server code.
CREATE OR REPLACE FUNCTION public.career_risk_score(_user_id uuid)
 RETURNS integer
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(sum(points), 0)::int FROM public.career_risk_signals
  WHERE user_id = _user_id AND created_at > now() - interval '30 days'
$$;
REVOKE ALL ON FUNCTION public.career_risk_score(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.career_risk_score(uuid) TO service_role;