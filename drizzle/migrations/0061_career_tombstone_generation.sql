-- Career deletion is a durable tombstone, never a physical row delete.
-- The service-role-only invoker RPCs serialize delete and explicit recreation.
ALTER TABLE public.careers
  ADD COLUMN IF NOT EXISTS generation bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.careers
  DROP CONSTRAINT IF EXISTS careers_generation_positive;
ALTER TABLE public.careers
  ADD CONSTRAINT careers_generation_positive CHECK (generation > 0);

-- The browser can read an owner's head but all career mutations remain server-only.
REVOKE INSERT, UPDATE, DELETE ON public.careers FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.careers FROM PUBLIC, anon;
GRANT SELECT ON public.careers TO authenticated;
GRANT ALL ON public.careers TO service_role;

-- SECURITY INVOKER is intentional: this function is executable only by the
-- trusted server role, so it does not bypass RLS for a client role.
CREATE OR REPLACE FUNCTION public.create_manager_career(
  p_user_id uuid,
  p_state jsonb,
  p_expected_generation bigint DEFAULT NULL,
  p_verified_progress boolean DEFAULT false
)
RETURNS TABLE(status text, generation bigint, deleted_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_generation bigint;
  v_deleted_at timestamptz;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'career mutation requires service role' USING ERRCODE = '28000';
  END IF;
  IF p_user_id IS NULL
     OR p_state IS NULL
     OR pg_catalog.jsonb_typeof(p_state) <> 'object'
     OR pg_catalog.octet_length(p_state::text) > 400000
     OR p_expected_generation IS NOT NULL AND p_expected_generation < 1
  THEN
    RAISE EXCEPTION 'invalid career creation';
  END IF;

  -- Lock an existing head. If the row is absent, only an initial create with
  -- no expected generation may insert; recreation must name the tombstone head.
  SELECT c.generation, c.deleted_at
    INTO v_generation, v_deleted_at
    FROM public.careers AS c
   WHERE c.user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_generation IS NOT NULL THEN
      RETURN QUERY SELECT 'conflict_active'::text, p_expected_generation, NULL::timestamptz;
      RETURN;
    END IF;
    INSERT INTO public.careers (user_id, state, verified_progress, generation, deleted_at)
    VALUES (p_user_id, p_state, p_verified_progress, 1, NULL)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING careers.generation, careers.deleted_at
      INTO v_generation, v_deleted_at;
    IF FOUND THEN
      RETURN QUERY SELECT 'applied'::text, v_generation, v_deleted_at;
      RETURN;
    END IF;

    SELECT c.generation, c.deleted_at
      INTO v_generation, v_deleted_at
      FROM public.careers AS c
     WHERE c.user_id = p_user_id
     FOR UPDATE;
  END IF;

  IF v_deleted_at IS NULL THEN
    RETURN QUERY SELECT 'conflict_active'::text, v_generation, v_deleted_at;
    RETURN;
  END IF;
  IF p_expected_generation IS NULL OR p_expected_generation <> v_generation THEN
    RETURN QUERY SELECT 'conflict_deleted'::text, v_generation, v_deleted_at;
    RETURN;
  END IF;

  UPDATE public.careers AS c
     SET state = p_state,
         verified_progress = p_verified_progress,
         generation = c.generation + 1,
         deleted_at = NULL
   WHERE c.user_id = p_user_id
     AND c.generation = p_expected_generation
     AND c.deleted_at IS NOT NULL
  RETURNING c.generation, c.deleted_at INTO v_generation, v_deleted_at;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'conflict_deleted'::text, v_generation, v_deleted_at;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'applied'::text, v_generation, v_deleted_at;
END;
$$;

-- A repeated delete returns the same generation and timestamp. It is safe to
-- retry after an HTTP timeout and always leaves a row that blocks stale INSERTs.
CREATE OR REPLACE FUNCTION public.delete_manager_career(p_user_id uuid)
RETURNS TABLE(status text, generation bigint, deleted_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_generation bigint;
  v_deleted_at timestamptz;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'career mutation requires service role' USING ERRCODE = '28000';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid career owner';
  END IF;

  SELECT c.generation, c.deleted_at
    INTO v_generation, v_deleted_at
    FROM public.careers AS c
   WHERE c.user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.careers (user_id, state, verified_progress, generation, deleted_at)
    VALUES (p_user_id, '{}'::jsonb, false, 1, pg_catalog.clock_timestamp())
    ON CONFLICT (user_id) DO NOTHING
    RETURNING careers.generation, careers.deleted_at
      INTO v_generation, v_deleted_at;
    IF FOUND THEN
      RETURN QUERY SELECT 'applied'::text, v_generation, v_deleted_at;
      RETURN;
    END IF;
    SELECT c.generation, c.deleted_at
      INTO v_generation, v_deleted_at
      FROM public.careers AS c
     WHERE c.user_id = p_user_id
     FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'career head could not be locked';
  END IF;

  IF v_deleted_at IS NOT NULL THEN
    RETURN QUERY SELECT 'already_deleted'::text, v_generation, v_deleted_at;
    RETURN;
  END IF;

  UPDATE public.careers AS c
     SET generation = c.generation + 1,
         deleted_at = pg_catalog.clock_timestamp(),
         verified_progress = false
   WHERE c.user_id = p_user_id
  RETURNING c.generation, c.deleted_at INTO v_generation, v_deleted_at;
  RETURN QUERY SELECT 'applied'::text, v_generation, v_deleted_at;
END;
$$;

REVOKE ALL ON FUNCTION public.create_manager_career(uuid, jsonb, bigint, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_manager_career(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_manager_career(uuid, jsonb, bigint, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_manager_career(uuid)
  TO service_role;

COMMENT ON FUNCTION public.create_manager_career(uuid, jsonb, bigint, boolean)
  IS 'Atomic explicit career creation/recreation. A tombstone requires its current generation.';
COMMENT ON FUNCTION public.delete_manager_career(uuid)
  IS 'Idempotent server-only logical delete. The careers row remains as a stale-save barrier.';
