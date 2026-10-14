-- Browser-reported performance samples are observations, not trusted benchmarks.
-- Rate-limit to one sample per confirmed account per UTC hour. Never use
-- an admin/service-role client from a callable server function to insert these.
BEGIN;
ALTER TABLE public.tech_telemetry
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS measurement_origin text NOT NULL DEFAULT 'client_unverified';

ALTER TABLE public.tech_telemetry
  DROP CONSTRAINT IF EXISTS tech_telemetry_measurement_origin_check;
ALTER TABLE public.tech_telemetry
  ADD CONSTRAINT tech_telemetry_measurement_origin_check
  CHECK (measurement_origin IN ('client_unverified', 'server_verified'));

CREATE UNIQUE INDEX IF NOT EXISTS tech_telemetry_user_utc_hour
  ON public.tech_telemetry (
    user_id,
    date_trunc('hour', created_at AT TIME ZONE 'UTC')
  ) WHERE user_id IS NOT NULL;

ALTER TABLE public.tech_telemetry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tech_telemetry FROM PUBLIC, anon, authenticated;

-- Only explicit, self-owned, untrusted browser samples can be submitted.
-- No grants on measurement_origin or created_at: caller cannot declare itself trusted
-- or backdate samples to bypass the unique per-hour server timestamp.
GRANT INSERT (
  user_id, fps_avg, frame_time_p95_ms, browser, gpu_tier,
  graphics_preset, load_time_ms, error_code, app_version
) ON TABLE public.tech_telemetry TO authenticated;

DROP POLICY IF EXISTS "Submit own untrusted browser metrics" ON public.tech_telemetry;
CREATE POLICY "Submit own untrusted browser metrics" ON public.tech_telemetry
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND measurement_origin = 'client_unverified'
  );
COMMIT;