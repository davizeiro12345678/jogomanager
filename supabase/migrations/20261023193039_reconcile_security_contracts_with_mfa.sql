-- Apply the missing canonical security contract before repairing its history.
-- Canonical source: supabase/migrations/20261020101601_restore_missing_security_contracts.sql
-- Canonical normalized SHA-256: 09b15ebce02e19f35963d6f10a30568d1b3c94f5812b4a930ee60f738514a438
-- Existing users, redemptions, allocations and wallet balances are preserved.
-- A replay has already executed the canonical version and leaves its history intact.
BEGIN;
-- Reconcile application contracts that existed in Git but were never recorded
-- in the production migration history. Incremental: no resets, no data copies.
-- The public coupon RPC remains an invoker wrapper around a private implementation.
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


-- Preserve the later MFA boundary when restoring the private coupon implementation.
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
  -- SECURITY DEFINER bypasses wallet RLS: require the caller's enrolled MFA too.
  IF NOT app_private.mfa_session_allowed() THEN
    RETURN jsonb_build_object('ok',false,'reason','mfa_required');
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

-- Do not record an old version unless its complete access contracts really hold.
DO $contracts$
BEGIN

  ASSERT NOT EXISTS (
    SELECT 1 FROM public.game_coupons
    WHERE active AND code IN (
      'BEMVINDO', 'VOLTEI', 'JOGOMANAGER', 'OLHEIRO',
      'TREINADOR', 'CRIADOR', 'VARZEA', 'CLASSICO'
    )
  ), 'Predictable seed coupons remain active';

  ASSERT NOT has_function_privilege('anon', 'public.redeem_game_coupon(text)', 'EXECUTE'),
    'Anonymous coupon execution must remain denied';
  ASSERT has_function_privilege('authenticated', 'public.redeem_game_coupon(text)', 'EXECUTE'),
    'Authenticated coupon callers lost the public contract';
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.redeem_game_coupon(text)'::regprocedure),
    'The public coupon RPC must run as its caller';
  ASSERT (SELECT prosecdef FROM pg_proc WHERE oid = 'app_private.redeem_game_coupon(text)'::regprocedure),
    'The private coupon implementation lost its isolated privilege boundary';
  ASSERT strpos(pg_get_functiondef('app_private.redeem_game_coupon(text)'::regprocedure),
    'app_private.mfa_session_allowed()') > 0,
    'Coupon rewards must enforce enrolled MFA before privileged wallet writes';
  ASSERT NOT has_table_privilege('authenticated', 'public.coupon_eligible_users', 'INSERT'),
    'A caller must not grant itself coupon eligibility';

  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.get_public_activity_rankings(integer)'::regprocedure)
    AND NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'app_private.get_public_activity_rankings(integer)'::regprocedure),
    'Both ranking functions must obey caller RLS';
  ASSERT NOT has_column_privilege('anon', 'public.activity_rankings', 'user_id', 'SELECT'),
    'Anonymous users must not read ranking account identifiers';
  ASSERT has_column_privilege('anon', 'public.activity_rankings', 'public_name', 'SELECT'),
    'Public ranking names must remain readable';

  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.tech_telemetry'::regclass),
    'Telemetry row-level security must remain enabled';
  ASSERT NOT has_any_column_privilege('anon', 'public.tech_telemetry', 'INSERT'),
    'Anonymous telemetry inserts must remain denied';
  ASSERT NOT has_any_column_privilege('service_role', 'public.tech_telemetry', 'INSERT'),
    'The retired privileged telemetry insertion path must remain denied';
  ASSERT has_column_privilege('authenticated', 'public.tech_telemetry', 'user_id', 'INSERT'),
    'Authenticated telemetry ownership column must remain insertable';
  ASSERT NOT has_column_privilege('authenticated', 'public.tech_telemetry', 'created_at', 'INSERT')
    AND NOT has_column_privilege('authenticated', 'public.tech_telemetry', 'measurement_origin', 'INSERT'),
    'Browser callers must not set trusted origin or backdate telemetry';
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tech_telemetry'::regclass
      AND conname = 'tech_telemetry_user_id_fkey'
      AND contype = 'f' AND convalidated
      AND confrelid = 'auth.users'::regclass
  ), 'Telemetry ownership foreign key must be validated';
  ASSERT EXISTS (
    SELECT 1 FROM pg_index
    WHERE indexrelid = 'public.tech_telemetry_user_utc_hour'::regclass
      AND indisunique AND indisvalid AND indisready
  ), 'The unique telemetry hour index must be ready and valid';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.tech_telemetry'::regclass
      AND polname = 'Submit own untrusted browser metrics'
      AND polcmd = 'a'
      AND pg_get_expr(polwithcheck, polrelid) LIKE '%is_confirmed_telemetry_sender%'
  ), 'Direct telemetry insert policy must require a confirmed sender';
END;
$contracts$;
DO $mfa_contract$
BEGIN
  ASSERT strpos(pg_get_functiondef('app_private.redeem_game_coupon(text)'::regprocedure),
    'app_private.mfa_session_allowed()') > 0, 'Coupon redemption must enforce enrolled MFA';
END;
$mfa_contract$;

-- Equivalent to migration repair after the actual canonical SQL above succeeded.
-- Keep the original SQL as provenance; never overwrite an existing history row.
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)
VALUES ('20261020101601','restore_missing_security_contracts',ARRAY[$canonical_sql$
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
$canonical_sql$])
ON CONFLICT (version) DO NOTHING;
COMMIT;
