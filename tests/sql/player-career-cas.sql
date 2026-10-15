\set ON_ERROR_STOP on
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('request.jwt.claim.role', true), '') $$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
\ir ../../drizzle/migrations/0025_create_player_careers.sql
\ir ../../drizzle/migrations/0035_player_career_atomic_sync.sql

-- This is a test-only session. PostgreSQL roles simulate Supabase JWT claims.
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;

DO $$
DECLARE
  result_status text;
  result_revision bigint;
  state jsonb := '{"version":1,"slot":1,"seed":"s1","season":1,"week":1,"name":"Atleta","clubId":"club"}';
BEGIN
  IF has_table_privilege(current_user, 'public.player_careers', 'INSERT') THEN
    RAISE EXCEPTION 'Direct athlete writes were not revoked';
  END IF;
  SELECT status, new_revision INTO result_status, result_revision
  FROM public.mutate_player_career(1, 0, 'save', state);
  IF result_status <> 'applied' OR result_revision <> 1 THEN
    RAISE EXCEPTION 'Initial insert failed: %, %', result_status, result_revision;
  END IF;

  -- A second device booted offline and tried to insert the same slot.
  SELECT status, new_revision INTO result_status, result_revision
  FROM public.mutate_player_career(1, 0, 'save', state);
  IF result_status <> 'conflict' OR result_revision <> 1 THEN
    RAISE EXCEPTION 'Duplicate first revision was not blocked';
  END IF;

  -- A second real week, with the acknowledged revision.
  SELECT status, new_revision INTO result_status, result_revision
  FROM public.mutate_player_career(
    1, 1, 'save', state || '{"week":2}'::jsonb
  );
  IF result_status <> 'applied' OR result_revision <> 2 THEN
    RAISE EXCEPTION 'CAS update failed';
  END IF;

  -- Old device cannot replace the newer progress.
  SELECT status, new_revision INTO result_status, result_revision
  FROM public.mutate_player_career(1, 1, 'save', state);
  IF result_status <> 'conflict' OR result_revision <> 2 THEN
    RAISE EXCEPTION 'Stale CAS update overwrote a newer save';
  END IF;

  -- Even a valid CAS revision cannot move a career backward.
  SELECT status, new_revision INTO result_status, result_revision
  FROM public.mutate_player_career(1, 2, 'save', state);
  IF result_status <> 'conflict' OR result_revision <> 2 THEN
    RAISE EXCEPTION 'Season-week regression should fail';
  END IF;

  -- Delete creates a tombstone, not a missing row.
  SELECT status, new_revision INTO result_status, result_revision
  FROM public.mutate_player_career(1, 2, 'delete');
  IF result_status <> 'applied' OR result_revision <> 3 THEN
    RAISE EXCEPTION 'Delete tombstone was not persisted';
  END IF;

  SELECT status, new_revision INTO result_status, result_revision
  FROM public.mutate_player_career(1, 2, 'save', state);
  IF result_status <> 'conflict' OR result_revision <> 3 THEN
    RAISE EXCEPTION 'Old device resurrected deleted save';
  END IF;

  -- A deliberate restore after the tombstone can revive a different identity.
  SELECT status, new_revision INTO result_status, result_revision
  FROM public.mutate_player_career(1, 3, 'save', state || '{"seed":"s2"}'::jsonb);
  IF result_status <> 'applied' OR result_revision <> 4 THEN
    RAISE EXCEPTION 'Explicit restore failed';
  END IF;
  IF (SELECT sync_revision FROM public.player_careers WHERE slot = 1) <> 4 THEN
    RAISE EXCEPTION 'Revision was not durable';
  END IF;
END;
$$;

-- A second authenticated account cannot see or mutate the first account.
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
DO $$
DECLARE
  result_status text;
  result_revision bigint;
BEGIN
  IF (SELECT count(*) FROM public.player_careers) <> 0 THEN
    RAISE EXCEPTION 'RLS exposes another user career';
  END IF;
  SELECT status, new_revision INTO result_status, result_revision
  FROM public.mutate_player_career(1, 4, 'delete');
  IF result_status <> 'conflict' OR result_revision <> 0 THEN
    RAISE EXCEPTION 'Owner-boundary mutation should conflict';
  END IF;
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT set_config('request.jwt.claim.sub', '', false);
SET ROLE anon;
DO $$
BEGIN
  IF has_function_privilege(
    current_user,
    'public.mutate_player_career(integer,bigint,text,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Anon unexpectedly can execute career RPC';
  END IF;
END;
$$;
