-- Reconcile application contracts that existed in Git but were never recorded
-- in the production migration history. Incremental: no resets, no data copies.
-- The public coupon RPC remains an invoker wrapper around a private implementation.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Restore the 14 October contract: deny predictable, unlimited rewards.
-- Existing redemption and allocation records are preserved. A campaign can be
-- explicitly re-enabled after its eligible users have been allocated grants.
UPDATE public.game_coupons
SET active = false
WHERE code IN ('BEMVINDO','VOLTEI','JOGOMANAGER','OLHEIRO','TREINADOR','CRIADOR','VARZEA','CLASSICO')
  AND active = true;

CREATE OR REPLACE FUNCTION app_private.redeem_game_coupon(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _c public.game_coupons%ROWTYPE;
  _norm text := upper(regexp_replace(coalesce(_code, ''), '\s', '', 'g'));
  _email_verified boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','login');
  END IF;
  -- Authentication alone is not proof of mailbox ownership.
  SELECT (u.email_confirmed_at IS NOT NULL)
  INTO _email_verified
  FROM auth.users u
  WHERE u.id = _uid;
  IF NOT coalesce(_email_verified,false) THEN
    RETURN jsonb_build_object('ok',false,'reason','verify_email');
  END IF;
  IF length(_norm) < 3 OR length(_norm) > 24 OR _norm !~ '^[A-Z0-9]+$' THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid');
  END IF;

  -- Every rewarding code is an explicitly issued grant. Published seed codes
  -- never grant an entitlement simply because a player can guess the text.
  IF NOT EXISTS (
    SELECT 1 FROM public.coupon_eligible_users AS e
    WHERE e.user_id = _uid
      AND e.code = _norm
      AND (e.expires_at IS NULL OR e.expires_at > now())
  ) THEN
    RETURN jsonb_build_object('ok',false,'reason','not_eligible');
  END IF;

  SELECT * INTO _c
  FROM public.game_coupons
  WHERE code = _norm
  FOR UPDATE;
  IF NOT FOUND OR NOT _c.active THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid');
  END IF;
  IF (_c.starts_at IS NOT NULL AND now() < _c.starts_at)
     OR (_c.ends_at IS NOT NULL AND now() > _c.ends_at) THEN
    RETURN jsonb_build_object('ok',false,'reason','expired');
  END IF;
  IF _c.max_redemptions IS NOT NULL AND _c.redemption_count >= _c.max_redemptions THEN
    RETURN jsonb_build_object('ok',false,'reason','sold_out');
  END IF;

  INSERT INTO public.coupon_redemptions(user_id,code)
  VALUES (_uid,_norm) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'reason','used');
  END IF;
  UPDATE public.game_coupons SET redemption_count=redemption_count+1 WHERE code=_norm;
  INSERT INTO public.user_wallet(user_id,coins,scout_reports,training_boosts)
  VALUES (_uid,_c.coins,_c.scout_reports,_c.training_boosts)
  ON CONFLICT(user_id) DO UPDATE SET
    coins=public.user_wallet.coins+EXCLUDED.coins,
    scout_reports=public.user_wallet.scout_reports+EXCLUDED.scout_reports,
    training_boosts=public.user_wallet.training_boosts+EXCLUDED.training_boosts;
  RETURN jsonb_build_object('ok',true,'description',_c.description,'coins',_c.coins,
    'scoutReports',_c.scout_reports,'trainingBoosts',_c.training_boosts);
END;
$fn$;
REVOKE ALL ON FUNCTION app_private.redeem_game_coupon(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.redeem_game_coupon(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_game_coupon(_code text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $wrapper$ SELECT app_private.redeem_game_coupon(_code); $wrapper$;
REVOKE ALL ON FUNCTION public.redeem_game_coupon(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_game_coupon(text) TO authenticated;

-- Expose only opted-in leaderboard columns through RLS, without an elevated anonymous function.
-- Both the public wrapper and its private implementation must run as the caller.
-- EXECUTE on the existing RPC is intentionally preserved.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.activity_rankings FROM anon;
GRANT SELECT (public_name, club_id, weekly_active_seconds,
  matches_completed, wins, active_streak, opted_in, updated_at)
  ON TABLE public.activity_rankings TO anon, authenticated;
ALTER FUNCTION public.get_public_activity_rankings(integer) SECURITY INVOKER;
ALTER FUNCTION public.get_public_activity_rankings(integer) SET search_path = '';
ALTER FUNCTION app_private.get_public_activity_rankings(integer) SECURITY INVOKER;
ALTER FUNCTION app_private.get_public_activity_rankings(integer) SET search_path = '';

-- Browser-reported performance samples are observations, not trusted benchmarks.
-- Rate-limit to one sample per confirmed account per UTC hour. Never use
-- an admin/service-role client from a callable server function to insert these.
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

-- Direct PostgREST inserts must enforce confirmation too, not only the server
-- handler. This helper can inspect only the caller's account, never an input UID.
CREATE OR REPLACE FUNCTION app_private.is_confirmed_telemetry_sender()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $confirmed$
  SELECT EXISTS (
    SELECT 1 FROM auth.users AS u
    WHERE u.id = (SELECT auth.uid()) AND u.email_confirmed_at IS NOT NULL
  );
$confirmed$;
REVOKE ALL ON FUNCTION app_private.is_confirmed_telemetry_sender()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_confirmed_telemetry_sender() TO authenticated;

DROP POLICY IF EXISTS "Submit own untrusted browser metrics" ON public.tech_telemetry;
CREATE POLICY "Submit own untrusted browser metrics" ON public.tech_telemetry
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND measurement_origin = 'client_unverified'
    AND (SELECT app_private.is_confirmed_telemetry_sender())
  );

-- A previous restore already created user_id without a foreign key. ADD COLUMN
-- IF NOT EXISTS alone cannot install the missing ownership constraint.
DO $ownership$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tech_telemetry'::regclass
      AND conname = 'tech_telemetry_user_id_fkey'
  ) THEN
    ALTER TABLE public.tech_telemetry
      ADD CONSTRAINT tech_telemetry_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$ownership$;

-- The old anonymous server entry must not bypass the new ownership/hour quota.
REVOKE INSERT ON TABLE public.tech_telemetry FROM service_role;
COMMIT;
