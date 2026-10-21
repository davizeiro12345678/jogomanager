-- Production post-release verification. No fixtures, DDL, writes or credentials.
-- Run only after the canonical incremental migration has been released.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';

DO $contracts$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version = '20261020101601'
  ), 'The canonical security migration is not recorded';
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

SELECT clock_timestamp() AS verified_at,
       'production_metadata_contracts_passed' AS result,
       (SELECT count(*) FROM supabase_migrations.schema_migrations) AS recorded_migrations;
ROLLBACK;
