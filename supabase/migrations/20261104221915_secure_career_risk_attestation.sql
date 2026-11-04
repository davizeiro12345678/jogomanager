-- Created with Supabase CLI 2.75.2 (migration new secure_career_risk_attestation).
-- Add only the missing risk-attestation primitives; do not retrofit other live RPCs.
-- The browser and authenticated role must never read or write risk signals.
CREATE TABLE IF NOT EXISTS public.career_risk_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('goals', 'budget', 'trophies', 'match_pace', 'season_pace')),
  points integer NOT NULL CHECK (points BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS career_risk_signals_owner_recent_idx
  ON public.career_risk_signals (user_id, created_at DESC)
  INCLUDE (points);

ALTER TABLE public.career_risk_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.career_risk_signals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.career_risk_signals TO service_role;

-- Only a trusted server using service_role can request a risk score.
-- SECURITY INVOKER keeps this function inside the caller's grants and RLS.
CREATE OR REPLACE FUNCTION public.career_risk_score(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $risk$
  SELECT LEAST(
    COALESCE(SUM(points), 0::bigint),
    2147483647::bigint
  )::integer
  FROM public.career_risk_signals
  WHERE user_id = _user_id
    AND created_at >= now() - interval '30 days';
$risk$;
REVOKE ALL PRIVILEGES ON FUNCTION public.career_risk_score(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.career_risk_score(uuid) TO service_role;
