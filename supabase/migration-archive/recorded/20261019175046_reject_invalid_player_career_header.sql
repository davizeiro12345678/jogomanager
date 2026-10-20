-- Require numeric version/slot headers even for direct authenticated RPC callers.
-- Existing saves/IDs, CAS, tombstones, monotonic progress and unverified status remain unchanged.
-- Missing JSON keys produce SQL NULL; <> does not reject NULL inside IF.
CREATE OR REPLACE FUNCTION public.mutate_player_career(p_slot integer, p_expected_revision bigint, p_operation text, p_state jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(status text, new_revision bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_revision bigint;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_slot IS NULL OR p_slot NOT BETWEEN 1 AND 3
     OR p_expected_revision IS NULL OR p_expected_revision < 0
     OR p_operation IS NULL OR p_operation NOT IN ('save', 'delete') THEN
    RAISE EXCEPTION 'invalid mutation';
  END IF;
  IF p_operation = 'save' AND (
    p_state IS NULL OR jsonb_typeof(p_state) <> 'object'
    OR p_state->'version' IS DISTINCT FROM '1'::jsonb
    OR p_state->'slot' IS DISTINCT FROM to_jsonb(p_slot)
    OR octet_length(p_state::text) > 400000
  ) THEN
    RAISE EXCEPTION 'invalid athlete save';
  END IF;

  IF p_expected_revision = 0 THEN
    INSERT INTO public.player_careers (
      user_id, slot, state, sync_revision, deleted_at, verified_progress
    )
    VALUES (
      v_user, p_slot,
      CASE WHEN p_operation = 'save' THEN p_state ELSE '{}'::jsonb END,
      1,
      CASE WHEN p_operation = 'delete' THEN now() ELSE NULL END,
      false
    )
    ON CONFLICT (user_id, slot) DO NOTHING
    RETURNING sync_revision INTO v_revision;
  ELSE
    UPDATE public.player_careers
    SET
      state = CASE WHEN p_operation = 'save' THEN p_state ELSE state END,
      deleted_at = CASE WHEN p_operation = 'delete' THEN now() ELSE NULL END,
      sync_revision = sync_revision + 1,
      verified_progress = false
    WHERE user_id = v_user AND slot = p_slot AND sync_revision = p_expected_revision
      AND (
        p_operation = 'delete'
        OR deleted_at IS NOT NULL
        OR (
          state->>'seed' = p_state->>'seed'
          AND (
            (p_state->>'season')::integer > (state->>'season')::integer
            OR (
              (p_state->>'season')::integer = (state->>'season')::integer
              AND (p_state->>'week')::integer >= (state->>'week')::integer
            )
          )
        )
      )
    RETURNING sync_revision INTO v_revision;
  END IF;

  IF v_revision IS NOT NULL THEN
    RETURN QUERY SELECT 'applied'::text, v_revision;
    RETURN;
  END IF;

  SELECT pc.sync_revision INTO v_revision
  FROM public.player_careers pc
  WHERE pc.user_id = v_user AND pc.slot = p_slot;
  RETURN QUERY SELECT 'conflict'::text, COALESCE(v_revision, 0::bigint);
END;
$function$;

REVOKE ALL ON FUNCTION public.mutate_player_career(integer, bigint, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mutate_player_career(integer, bigint, text, jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.mutate_player_career(integer, bigint, text, jsonb)
  IS 'Atomic owner-scoped CAS save/delete. Requires numeric version and slot headers. Revisions are server managed; never attests gameplay.';
