-- Versões geridas exclusivamente pelo servidor. Migração aditiva, sem apagar saves.
ALTER TABLE public.player_careers
  ADD COLUMN IF NOT EXISTS sync_revision bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.player_careers
  ADD CONSTRAINT player_careers_sync_revision_positive CHECK (sync_revision > 0);

-- Escrita direta com RLS não exige controle de revisão: bloquear a rota antiga.
REVOKE INSERT, UPDATE, DELETE ON public.player_careers FROM authenticated;
GRANT SELECT ON public.player_careers TO authenticated;

-- SECURITY DEFINER apenas para a operação autenticada, sem acesso do papel anon.
CREATE OR REPLACE FUNCTION public.mutate_player_career(
  p_slot integer,
  p_expected_revision bigint,
  p_operation text,
  p_state jsonb DEFAULT NULL
)
RETURNS TABLE(status text, new_revision bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_revision bigint;
BEGIN
  IF auth.role() <> 'authenticated' OR v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_slot NOT BETWEEN 1 AND 3 OR p_expected_revision < 0
     OR p_expected_revision IS NULL OR p_operation NOT IN ('save', 'delete') THEN
    RAISE EXCEPTION 'invalid mutation';
  END IF;
  IF p_operation = 'save' AND (
    p_state IS NULL OR jsonb_typeof(p_state) <> 'object'
    OR p_state->>'version' <> '1'
    OR (p_state->>'slot')::integer IS DISTINCT FROM p_slot
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
$$;

REVOKE ALL ON FUNCTION public.mutate_player_career(integer, bigint, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mutate_player_career(integer, bigint, text, jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.mutate_player_career(integer, bigint, text, jsonb)
  IS 'Atomic owner-scoped CAS save/delete. Revisions are server managed, tombstones prevent stale resurrection; never attests gameplay.';
