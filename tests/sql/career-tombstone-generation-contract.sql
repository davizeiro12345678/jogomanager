\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $privileges$
BEGIN
  ASSERT has_table_privilege('authenticated', 'public.careers', 'SELECT'),
    'authenticated must retain owner-scoped career reads';
  ASSERT NOT has_table_privilege('authenticated', 'public.careers', 'INSERT,UPDATE,DELETE'),
    'authenticated must not mutate career heads directly';
  ASSERT NOT has_table_privilege('anon', 'public.careers', 'SELECT,INSERT,UPDATE,DELETE'),
    'anon must not access career heads';
  ASSERT has_table_privilege('service_role', 'public.careers', 'SELECT,INSERT,UPDATE,DELETE'),
    'service_role must retain server-side career access';
  ASSERT has_function_privilege(
    'service_role', 'public.create_manager_career(uuid,jsonb,bigint,boolean)', 'EXECUTE'
  ), 'service_role must be able to create or explicitly recreate a career';
  ASSERT has_function_privilege(
    'service_role', 'public.delete_manager_career(uuid)', 'EXECUTE'
  ), 'service_role must be able to tombstone a career';
  ASSERT NOT has_function_privilege(
    'authenticated', 'public.create_manager_career(uuid,jsonb,bigint,boolean)', 'EXECUTE'
  ) AND NOT has_function_privilege(
    'anon', 'public.create_manager_career(uuid,jsonb,bigint,boolean)', 'EXECUTE'
  ), 'career creation must remain server-only';
  ASSERT NOT has_function_privilege(
    'authenticated', 'public.delete_manager_career(uuid)', 'EXECUTE'
  ) AND NOT has_function_privilege(
    'anon', 'public.delete_manager_career(uuid)', 'EXECUTE'
  ), 'career deletion must remain server-only';
  ASSERT NOT (SELECT prosecdef FROM pg_proc
    WHERE oid = 'public.create_manager_career(uuid,jsonb,bigint,boolean)'::regprocedure),
    'create RPC must remain SECURITY INVOKER';
  ASSERT NOT (SELECT prosecdef FROM pg_proc
    WHERE oid = 'public.delete_manager_career(uuid)'::regprocedure),
    'delete RPC must remain SECURITY INVOKER';
END;
$privileges$;

SELECT set_config('jogomanager.test.main_user', gen_random_uuid()::text, true);
SELECT set_config('jogomanager.test.initial_user', gen_random_uuid()::text, true);
SELECT set_config('jogomanager.test.empty_delete_user', gen_random_uuid()::text, true);
INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
  (current_setting('jogomanager.test.main_user')::uuid,
   'career-tombstone-' || gen_random_uuid()::text || '@example.invalid', '{}'::jsonb, NULL),
  (current_setting('jogomanager.test.initial_user')::uuid,
   'career-initial-' || gen_random_uuid()::text || '@example.invalid', '{}'::jsonb, NULL),
  (current_setting('jogomanager.test.empty_delete_user')::uuid,
   'career-empty-delete-' || gen_random_uuid()::text || '@example.invalid', '{}'::jsonb, NULL);

SET LOCAL ROLE service_role;
DO $lifecycle$
DECLARE
  v_user uuid := current_setting('jogomanager.test.main_user')::uuid;
  v_initial_user uuid := current_setting('jogomanager.test.initial_user')::uuid;
  v_empty_delete_user uuid := current_setting('jogomanager.test.empty_delete_user')::uuid;
  v_status text;
  v_generation bigint;
  v_deleted_at timestamptz;
  v_first_deleted_at timestamptz;
  v_row record;
BEGIN
  INSERT INTO public.careers (user_id, state, verified_progress, generation, deleted_at)
  VALUES (v_user, '{"round":3}'::jsonb, true, 1, NULL);

  SELECT status, generation, deleted_at
    INTO v_status, v_generation, v_deleted_at
    FROM public.delete_manager_career(v_user);
  ASSERT v_status = 'applied' AND v_generation = 2 AND v_deleted_at IS NOT NULL,
    'deleting an active career must advance its generation and persist a tombstone';
  v_first_deleted_at := v_deleted_at;

  SELECT status, generation, deleted_at
    INTO v_status, v_generation, v_deleted_at
    FROM public.delete_manager_career(v_user);
  ASSERT v_status = 'already_deleted' AND v_generation = 2 AND v_deleted_at = v_first_deleted_at,
    'repeated delete must be idempotent';
  SELECT generation, deleted_at, verified_progress, state
    INTO v_row FROM public.careers WHERE user_id = v_user;
  ASSERT v_row.generation = 2 AND v_row.deleted_at = v_first_deleted_at
    AND NOT v_row.verified_progress AND v_row.state = '{"round":3}'::jsonb,
    'delete must retain recovery state, revoke attestation, and keep the tombstone';

  SELECT status, generation INTO v_status, v_generation
    FROM public.create_manager_career(v_user, '{"round":1}'::jsonb, NULL, false);
  ASSERT v_status = 'conflict_deleted' AND v_generation = 2,
    'a stale device must not recreate a deleted career without its generation';
  SELECT status, generation INTO v_status, v_generation
    FROM public.create_manager_career(v_user, '{"round":1}'::jsonb, 1, false);
  ASSERT v_status = 'conflict_deleted' AND v_generation = 2,
    'a stale generation must not cross a tombstone';

  SELECT status, generation, deleted_at
    INTO v_status, v_generation, v_deleted_at
    FROM public.create_manager_career(v_user, '{"round":1}'::jsonb, 2, false);
  ASSERT v_status = 'applied' AND v_generation = 3 AND v_deleted_at IS NULL,
    'explicit recreation at the current tombstone generation must advance the head';
  SELECT generation, deleted_at, verified_progress, state
    INTO v_row FROM public.careers WHERE user_id = v_user;
  ASSERT v_row.generation = 3 AND v_row.deleted_at IS NULL
    AND NOT v_row.verified_progress AND v_row.state = '{"round":1}'::jsonb,
    'recreation must write the new state at a fresh unverified generation';

  SELECT status, generation INTO v_status, v_generation
    FROM public.create_manager_career(v_user, '{"round":99}'::jsonb, 2, false);
  ASSERT v_status = 'conflict_active' AND v_generation = 3,
    'a second create must not overwrite an active career';

  SELECT status, generation INTO v_status, v_generation
    FROM public.delete_manager_career(v_user);
  ASSERT v_status = 'applied' AND v_generation = 4,
    'deleting the recreated career must advance the generation again';
  SELECT status, generation INTO v_status, v_generation
    FROM public.create_manager_career(v_user, '{"round":2}'::jsonb, 3, false);
  ASSERT v_status = 'conflict_deleted' AND v_generation = 4,
    'a stale pre-delete generation must not cross a later tombstone';
  SELECT status, generation INTO v_status, v_generation
    FROM public.create_manager_career(v_user, '{"round":2}'::jsonb, 4, false);
  ASSERT v_status = 'applied' AND v_generation = 5,
    'the newest tombstone generation must be explicitly recreatable';

  SELECT status, generation, deleted_at
    INTO v_status, v_generation, v_deleted_at
    FROM public.create_manager_career(v_initial_user, '{"round":1}'::jsonb, NULL, false);
  ASSERT v_status = 'applied' AND v_generation = 1 AND v_deleted_at IS NULL,
    'the explicit create operation may initialize a never-before-used career';
  SELECT status, generation INTO v_status, v_generation
    FROM public.create_manager_career(v_initial_user, '{"round":99}'::jsonb, NULL, false);
  ASSERT v_status = 'conflict_active' AND v_generation = 1,
    'initial create must not overwrite an already active career';

  SELECT status, generation, deleted_at
    INTO v_status, v_generation, v_deleted_at
    FROM public.delete_manager_career(v_empty_delete_user);
  ASSERT v_status = 'applied' AND v_generation = 1 AND v_deleted_at IS NOT NULL,
    'deleting a missing head must create a durable tombstone against stale inserts';
  SELECT status, generation INTO v_status, v_generation
    FROM public.create_manager_career(v_empty_delete_user, '{"round":1}'::jsonb, NULL, false);
  ASSERT v_status = 'conflict_deleted' AND v_generation = 1,
    'an absent-head tombstone must reject a stale initial create';
  SELECT status, generation INTO v_status, v_generation
    FROM public.create_manager_career(v_empty_delete_user, '{"round":1}'::jsonb, 1, false);
  ASSERT v_status = 'applied' AND v_generation = 2,
    'the tombstone created for a missing head must support explicit recovery';
END;
$lifecycle$;
RESET ROLE;
ROLLBACK;
