ALTER TABLE public.player_careers
  ADD COLUMN IF NOT EXISTS sync_revision bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.player_careers DROP CONSTRAINT IF EXISTS player_careers_sync_revision_positive;
ALTER TABLE public.player_careers
  ADD CONSTRAINT player_careers_sync_revision_positive CHECK (sync_revision > 0);

REVOKE INSERT, UPDATE, DELETE ON public.player_careers FROM authenticated;
GRANT SELECT ON public.player_careers TO authenticated;
GRANT ALL ON public.player_careers TO service_role;

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
    INSERT INTO public.player_careers (user_id, slot, state, sync_revision, deleted_at, verified_progress)
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

CREATE TABLE IF NOT EXISTS public.player_career_revisions (
  user_id uuid NOT NULL,
  slot smallint NOT NULL CHECK(slot BETWEEN 1 AND 3),
  revision bigint NOT NULL CHECK(revision > 0),
  state jsonb NOT NULL CHECK(jsonb_typeof(state)='object'),
  operation text NOT NULL CHECK(operation IN ('save','delete')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,slot,revision),
  FOREIGN KEY(user_id,slot) REFERENCES public.player_careers(user_id,slot) ON DELETE CASCADE
);
REVOKE ALL ON public.player_career_revisions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.player_career_revisions TO authenticated;
GRANT ALL ON public.player_career_revisions TO service_role;
ALTER TABLE public.player_career_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read career revisions" ON public.player_career_revisions;
CREATE POLICY "Owners read career revisions" ON public.player_career_revisions
 FOR SELECT TO authenticated USING((select auth.uid())=user_id);

CREATE OR REPLACE FUNCTION public.record_player_career_revision()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.player_career_revisions(user_id,slot,revision,state,operation)
 VALUES(NEW.user_id,NEW.slot,NEW.sync_revision,NEW.state,
   CASE WHEN NEW.deleted_at IS NULL THEN 'save' ELSE 'delete' END)
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.record_player_career_revision() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS record_player_career_revision ON public.player_careers;
CREATE TRIGGER record_player_career_revision AFTER INSERT OR UPDATE OF sync_revision
 ON public.player_careers FOR EACH ROW EXECUTE FUNCTION public.record_player_career_revision();

NOTIFY pgrst, 'reload schema';