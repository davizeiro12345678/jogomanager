-- Only for a disposable, migrated database. All captured fixtures roll back.
BEGIN;
DO $permissions$
DECLARE fn regprocedure;
BEGIN
  ASSERT NOT has_schema_privilege('anon', 'database_growth_private', 'USAGE'),
    'Anonymous clients must not see private growth metrics';
  ASSERT NOT has_schema_privilege('authenticated', 'database_growth_private', 'USAGE'),
    'User sessions must not see private growth metrics';
  FOREACH fn IN ARRAY ARRAY[
    'public.capture_database_growth_snapshot()'::regprocedure,
    'public.list_database_growth_snapshots(integer,integer)'::regprocedure,
    'public.get_database_growth_snapshot(bigint,integer,integer)'::regprocedure
  ] LOOP
    ASSERT NOT has_function_privilege('anon', fn, 'EXECUTE'), 'Anonymous RPC exposure';
    ASSERT NOT has_function_privilege('authenticated', fn, 'EXECUTE'), 'Authenticated RPC exposure';
    ASSERT has_function_privilege('service_role', fn, 'EXECUTE'), 'Server RPC access missing';
    ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = fn), 'Metrics RPC must be SECURITY INVOKER';
  END LOOP;
END;
$permissions$;
SET LOCAL ROLE anon;
DO $anonymous$
BEGIN
  BEGIN
    PERFORM public.capture_database_growth_snapshot();
    RAISE EXCEPTION 'Anonymous capture succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$anonymous$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $authenticated$
BEGIN
  BEGIN
    PERFORM public.list_database_growth_snapshots(1,0);
    RAISE EXCEPTION 'Authenticated history access succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$authenticated$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $capture$
DECLARE captured jsonb; details jsonb; history jsonb; snapshot_id bigint;
BEGIN
  captured := public.capture_database_growth_snapshot();
  snapshot_id := (captured->>'snapshotId')::bigint;
  ASSERT snapshot_id > 0 AND (captured->>'databaseSizeBytes')::bigint > 0,
    'Catalog snapshot must return real positive database size';
  details := public.get_database_growth_snapshot(snapshot_id,1,1);
  ASSERT (details->'summary'->>'snapshotId')::bigint = snapshot_id,
    'Snapshot detail must match its captured identity';
  ASSERT jsonb_array_length(details->'tables') <= 1 AND jsonb_array_length(details->'indexes') <= 1,
    'Detail limits must be enforced';
  history := public.list_database_growth_snapshots(1,0);
  ASSERT jsonb_array_length(history) = 1 AND (history->0->>'snapshotId')::bigint = snapshot_id,
    'Bounded history must include the newly captured snapshot';
  ASSERT public.get_database_growth_snapshot(9223372036854775807,1,1) IS NULL,
    'Missing snapshot must not fabricate detail';
  BEGIN
    PERFORM public.list_database_growth_snapshots(101,0);
    RAISE EXCEPTION 'Oversized history accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.get_database_growth_snapshot(snapshot_id,1001,1);
    RAISE EXCEPTION 'Oversized table detail accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END;
$capture$;
RESET ROLE;
ROLLBACK;
