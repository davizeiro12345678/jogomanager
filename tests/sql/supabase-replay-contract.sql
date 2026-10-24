-- Run only against a disposable, fully migrated database. Every fixture rolls back.
BEGIN;

DO $contract$
BEGIN
  ASSERT (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') >= 68,
    'The full application schema was not replayed';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity),
    'Every public table must retain RLS';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'players' AND column_name = 'source_id'), 'Missing source identity';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'players' AND column_name = 'canonical_player_id'), 'Missing player aliases';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'players' AND column_name = 'source_kind'), 'Missing playable-player classification';
  ASSERT to_regclass('public.players_name_search_trgm_idx') IS NOT NULL, 'Missing market index';
  ASSERT to_regclass('public.players_club_cursor_idx') IS NOT NULL, 'Missing squad keyset index';
  ASSERT NOT has_table_privilege('authenticated', 'public.player_careers', 'INSERT'),
    'Direct writes would bypass career CAS';
  ASSERT NOT has_table_privilege('anon', 'public.api_football_data', 'SELECT'),
    'Provider archives must remain private';
  ASSERT NOT has_function_privilege('anon', 'public.get_public_league_digest_source(integer[])', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.get_public_league_digest_source(integer[])', 'EXECUTE'),
    'Raw league digest RPC must be server-only';
  ASSERT has_function_privilege('service_role', 'public.get_public_league_digest_source(integer[])', 'EXECUTE'),
    'The server must be able to build a digest';
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.redeem_game_coupon(text)'::regprocedure),
    'The public coupon API must remain an invoker wrapper';
  ASSERT NOT EXISTS (SELECT 1 FROM football_import_private.settings WHERE enabled
    OR api_key_secret IS NOT NULL OR worker_secret IS NOT NULL OR project_url IS NOT NULL),
    'A fresh preview must not inherit production import credentials or activate imports';
  ASSERT football_import_private.invoke_worker() IS NULL,
    'A fresh preview must not start billable provider imports';
END;
$contract$;

INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
 ('22222222-2222-4222-8222-222222222221', 'replay-unverified@example.invalid', '{}', NULL),
 ('22222222-2222-4222-8222-222222222222', 'replay-verified@example.invalid', '{}', now());
INSERT INTO public.activity_rankings (user_id, public_name, opted_in, weekly_active_seconds) VALUES
 ('22222222-2222-4222-8222-222222222221', 'ReplayPrivate', false, 120),
 ('22222222-2222-4222-8222-222222222222', 'ReplayPublic', true, 60);
INSERT INTO public.game_coupons (code, description, coins, active)
VALUES ('REPLAYTEST', 'Isolated migration regression fixture', 100, true);

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222221', true);
SET LOCAL ROLE authenticated;
DO $contract$
BEGIN
  ASSERT public.redeem_game_coupon('REPLAYTEST')->>'reason' = 'verify_email',
    'Unconfirmed accounts must not receive coupon rewards';
  BEGIN
    INSERT INTO public.tech_telemetry (user_id, fps_avg, browser, app_version)
    VALUES ('22222222-2222-4222-8222-222222222221', 60, 'chrome', 'migration-test');
    RAISE EXCEPTION 'Unconfirmed account inserted telemetry directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$contract$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SET LOCAL ROLE authenticated;
DO $contract$
BEGIN
  ASSERT public.redeem_game_coupon('REPLAYTEST')->>'reason' = 'not_eligible',
    'Knowing a code must not grant an allocation';
END;
$contract$;
RESET ROLE;
INSERT INTO public.coupon_eligible_users (code, user_id)
VALUES ('REPLAYTEST', '22222222-2222-4222-8222-222222222222');

SET LOCAL ROLE authenticated;
DO $contract$
DECLARE result jsonb; mutation record;
BEGIN
  result := public.redeem_game_coupon('REPLAYTEST');
  ASSERT result->>'ok' = 'true' AND result->>'coins' = '100', 'Eligible redemption failed';
  ASSERT public.redeem_game_coupon('REPLAYTEST')->>'reason' = 'used', 'Duplicate coupon reward';
  ASSERT NOT has_table_privilege(current_user, 'public.coupon_eligible_users', 'INSERT'),
    'Accounts must not assign themselves coupon eligibility';

  INSERT INTO public.tech_telemetry (user_id, fps_avg, browser, app_version)
  VALUES ('22222222-2222-4222-8222-222222222222', 60, 'chrome', 'migration-test');
  BEGIN
    INSERT INTO public.tech_telemetry (user_id, fps_avg, browser, app_version)
    VALUES ('22222222-2222-4222-8222-222222222221', 60, 'chrome', 'migration-test');
    RAISE EXCEPTION 'Telemetry accepted a different owner';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.tech_telemetry (user_id, fps_avg, browser, app_version)
    VALUES ('22222222-2222-4222-8222-222222222222', 60, 'chrome', 'migration-test');
    RAISE EXCEPTION 'Telemetry accepted a second sample in the same UTC hour';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.tech_telemetry (user_id, measurement_origin)
    VALUES ('22222222-2222-4222-8222-222222222222', 'server_verified');
    RAISE EXCEPTION 'A client declared itself a trusted benchmark';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.tech_telemetry (user_id, created_at)
    VALUES ('22222222-2222-4222-8222-222222222222', now() - interval '1 day');
    RAISE EXCEPTION 'A client backdated samples to evade its quota';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  SELECT * INTO mutation FROM public.mutate_player_career(1, 0, 'save',
    '{"version":1,"slot":1,"seed":"replay-fixture","season":1,"week":1}');
  ASSERT mutation.status = 'applied' AND mutation.new_revision = 1, 'Career insert failed';
  SELECT * INTO mutation FROM public.mutate_player_career(1, 0, 'save',
    '{"version":1,"slot":1,"seed":"replay-fixture","season":1,"week":1}');
  ASSERT mutation.status = 'conflict' AND mutation.new_revision = 1, 'Stale career overwrote revision';
  BEGIN
    PERFORM * FROM public.get_public_league_digest_source(ARRAY[71]);
    RAISE EXCEPTION 'Authenticated client called raw digest RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$contract$;
RESET ROLE;

DO $contract$
BEGIN
  ASSERT (SELECT coins FROM public.user_wallet WHERE user_id = '22222222-2222-4222-8222-222222222222') = 100,
    'Wallet reward must be granted once';
  ASSERT (SELECT measurement_origin FROM public.tech_telemetry
    WHERE user_id = '22222222-2222-4222-8222-222222222222') = 'client_unverified',
    'Browser telemetry must remain explicitly untrusted';
END;
$contract$;

INSERT INTO public.api_football_data (kind, ref, payload) VALUES
 ('standings', '777777:2026', '{"marker":"new"}'),
 ('standings', '777777:2025', '{"marker":"old"}'),
 ('injury', 'replay-injury', '{"league":{"id":777777}}');
SET LOCAL ROLE service_role;
DO $contract$
DECLARE digest record;
BEGIN
  SELECT * INTO digest FROM public.get_public_league_digest_source(ARRAY[777777,777777]);
  ASSERT digest.league_id = 777777 AND digest.injury_count = 1 AND digest.payload->>'marker' = 'new',
    'Digest must use latest standings, deduplicate IDs, and preserve injury count';
  ASSERT (SELECT count(*) FROM public.get_public_league_digest_source(ARRAY[777777,777777])) = 1,
    'Duplicate league IDs must be collapsed';
  BEGIN
    PERFORM * FROM public.get_public_league_digest_source(ARRAY[-1]);
    RAISE EXCEPTION 'Digest accepted an invalid league ID';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    INSERT INTO public.tech_telemetry (browser) VALUES ('chrome');
    RAISE EXCEPTION 'The retired privileged telemetry path can still insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$contract$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'anon', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE anon;
DO $contract$
BEGIN
  ASSERT NOT has_function_privilege(current_user, 'public.redeem_game_coupon(text)', 'EXECUTE'),
    'Anonymous coupon execution must stay blocked';
  ASSERT NOT has_any_column_privilege(current_user, 'public.tech_telemetry', 'INSERT'),
    'Anonymous telemetry must stay blocked';
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.get_public_activity_rankings(integer)'::regprocedure)
    AND NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'app_private.get_public_activity_rankings(integer)'::regprocedure),
    'Both public ranking wrapper and implementation must enforce caller RLS';
  ASSERT (SELECT count(*) FROM public.get_public_activity_rankings(100)
    WHERE public_name = 'ReplayPublic') = 1, 'Opted-in ranking must remain publicly readable';
  ASSERT NOT EXISTS (SELECT 1 FROM public.get_public_activity_rankings(100)
    WHERE public_name = 'ReplayPrivate'), 'Anonymous ranking exposed an opted-out account';
  ASSERT NOT has_column_privilege(current_user, 'public.activity_rankings', 'user_id', 'SELECT'),
    'Public ranking must not expose account identifiers';
END;
$contract$;
RESET ROLE;

-- MFA enrollment must close the existing personal-data policies and CAS RPC.
INSERT INTO public.game_coupons (code,description,coins,active)
VALUES ('REPLAYMFATEST','MFA coupon boundary fixture',7,true);
INSERT INTO public.coupon_eligible_users (code,user_id)
VALUES ('REPLAYMFATEST','22222222-2222-4222-8222-222222222222');
INSERT INTO auth.mfa_factors (id,user_id,factor_type,status,created_at,updated_at,secret)
VALUES ('33333333-3333-4333-8333-333333333331',
 '22222222-2222-4222-8222-222222222222','totp','verified',now(),now(),'disposable-test-secret');
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}', true);
SET LOCAL ROLE authenticated;
DO $mfa$
BEGIN
 ASSERT NOT app_private.mfa_session_allowed(), 'Verified factors must require AAL2';
 ASSERT public.redeem_game_coupon('REPLAYMFATEST')->>'reason'='mfa_required',
   'SECURITY DEFINER coupon rewards bypassed enrolled MFA';
 ASSERT NOT EXISTS (SELECT 1 FROM public.user_wallet), 'AAL1 must not read even its own wallet after MFA enrollment';
 BEGIN
  PERFORM * FROM public.mutate_player_career(1,0,'delete',null);
  RAISE EXCEPTION 'CAS RPC bypassed MFA';
 EXCEPTION WHEN invalid_authorization_specification THEN NULL;
 END;
END;
$mfa$;
RESET ROLE;
DO $mfa_wallet$
BEGIN
 ASSERT (SELECT coins FROM public.user_wallet WHERE user_id='22222222-2222-4222-8222-222222222222')=100,
   'AAL1 must not change wallet balances';
 ASSERT NOT EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE code='REPLAYMFATEST'),
   'AAL1 must not consume an allocated coupon';
END;
$mfa_wallet$;
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}', true);
SET LOCAL ROLE authenticated;
DO $mfa$
BEGIN
 ASSERT app_private.mfa_session_allowed(), 'AAL2 should restore access';
 ASSERT (SELECT coins FROM public.user_wallet WHERE user_id=auth.uid())=100, 'AAL2 must preserve ownership and existing wallet';
 ASSERT NOT EXISTS (SELECT 1 FROM public.user_wallet WHERE user_id<>auth.uid()), 'MFA must never weaken ownership';
 ASSERT public.redeem_game_coupon('REPLAYMFATEST')->>'ok'='true', 'AAL2 must restore eligible coupon redemption';
 ASSERT public.redeem_game_coupon('REPLAYMFATEST')->>'reason'='used', 'AAL2 must retain coupon idempotency';
 ASSERT (SELECT coins FROM public.user_wallet WHERE user_id=auth.uid())=107, 'The MFA coupon must reward once';
END;
$mfa$;
RESET ROLE;

ROLLBACK;
