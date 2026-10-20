-- Telemetry has no account login by design, so admission must happen before a
-- service-role insert. Store only a salted address hash, never the address.
CREATE TABLE IF NOT EXISTS public.tech_telemetry_rate_limits (
  bucket text PRIMARY KEY CHECK (bucket ~ '^tech-v1:[a-f0-9]{64}$'),
  window_started_at timestamptz NOT NULL,
  accepted integer NOT NULL DEFAULT 0 CHECK (accepted >= 0 AND accepted <= 7),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tech_telemetry_rate_limits_window_idx
  ON public.tech_telemetry_rate_limits (window_started_at);

ALTER TABLE public.tech_telemetry_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tech_telemetry_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.tech_telemetry_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_tech_telemetry_slot(_bucket text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_window timestamptz := date_trunc('minute', now());
  accepted_now integer;
BEGIN
  IF _bucket IS NULL OR _bucket !~ '^tech-v1:[a-f0-9]{64}$' THEN
    RETURN false;
  END IF;

  -- Bounded retention avoids turning anonymous traffic into a durable address
  -- catalogue. The index keeps this maintenance small on each admission.
  DELETE FROM public.tech_telemetry_rate_limits
  WHERE window_started_at < current_window - interval '2 hours';

  INSERT INTO public.tech_telemetry_rate_limits AS rate_limit (
    bucket, window_started_at, accepted, updated_at
  )
  VALUES (_bucket, current_window, 1, now())
  ON CONFLICT (bucket) DO UPDATE
  SET window_started_at = EXCLUDED.window_started_at,
      accepted = CASE
        WHEN rate_limit.window_started_at = EXCLUDED.window_started_at
          THEN LEAST(rate_limit.accepted + 1, 7)
        ELSE 1
      END,
      updated_at = now()
  RETURNING accepted INTO accepted_now;

  -- Six observations per minute per pseudonymous origin is enough for a
  -- single diagnostics page while limiting unauthenticated write amplification.
  RETURN accepted_now <= 6;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_tech_telemetry_slot(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tech_telemetry_slot(text) TO service_role;
