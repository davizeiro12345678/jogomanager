-- Source: drizzle/migrations/0025_create_player_careers.sql
CREATE TABLE public.player_careers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 3),
  state jsonb NOT NULL,
  verified_progress boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_careers TO authenticated;
GRANT ALL ON public.player_careers TO service_role;
ALTER TABLE public.player_careers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own player careers select" ON public.player_careers FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "own player careers insert" ON public.player_careers FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id AND verified_progress = false);
CREATE POLICY "own player careers update" ON public.player_careers FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id AND verified_progress = false);
CREATE POLICY "own player careers delete" ON public.player_careers FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
CREATE TRIGGER update_player_careers_updated_at BEFORE UPDATE ON public.player_careers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: drizzle/migrations/0034_push_subscriptions.sql
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  topics text[] NOT NULL DEFAULT ARRAY['jogos','lesoes','previsoes','novidades'],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push select" ON public.push_subscriptions FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "own push insert" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "own push update" ON public.push_subscriptions FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "own push delete" ON public.push_subscriptions FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Source: drizzle/migrations/0035_player_career_atomic_sync.sql
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
  IF p_slot IS NULL OR p_slot NOT BETWEEN 1 AND 3
     OR p_expected_revision IS NULL OR p_expected_revision < 0
     OR p_operation IS NULL OR p_operation NOT IN ('save', 'delete') THEN
    RAISE EXCEPTION 'invalid mutation';
  END IF;
  IF p_operation = 'save' AND (
    p_state IS NULL OR jsonb_typeof(p_state) <> 'object'
    OR p_state->>'version' <> '1'
    OR p_state->>'slot' IS DISTINCT FROM p_slot::text
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
$$;

REVOKE ALL ON FUNCTION public.mutate_player_career(integer, bigint, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mutate_player_career(integer, bigint, text, jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.mutate_player_career(integer, bigint, text, jsonb)
  IS 'Atomic owner-scoped CAS save/delete. Revisions are server managed, tombstones prevent stale resurrection; never attests gameplay.';

-- Eligibility is issued only by the backend; guessing a public coupon grants nothing.
CREATE TABLE public.coupon_eligible_users (
  code text NOT NULL REFERENCES public.game_coupons(code) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(code,user_id)
);
CREATE INDEX coupon_eligible_users_user_idx ON public.coupon_eligible_users(user_id);
ALTER TABLE public.coupon_eligible_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coupon_eligible_users FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.coupon_eligible_users TO service_role;

-- Immutable server history of CAS mutations, including deletion tombstones.
CREATE TABLE public.player_career_revisions (
  user_id uuid NOT NULL,
  slot smallint NOT NULL CHECK(slot BETWEEN 1 AND 3),
  revision bigint NOT NULL CHECK(revision > 0),
  state jsonb NOT NULL CHECK(jsonb_typeof(state)='object'),
  operation text NOT NULL CHECK(operation IN ('save','delete')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,slot,revision),
  FOREIGN KEY(user_id,slot) REFERENCES public.player_careers(user_id,slot) ON DELETE CASCADE
);
ALTER TABLE public.player_career_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_career_revisions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.player_career_revisions TO authenticated;
GRANT ALL ON public.player_career_revisions TO service_role;
CREATE POLICY "Owners read career revisions" ON public.player_career_revisions
 FOR SELECT TO authenticated USING((select auth.uid())=user_id);
CREATE OR REPLACE FUNCTION public.record_player_career_revision()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.player_career_revisions(user_id,slot,revision,state,operation)
 VALUES(NEW.user_id,NEW.slot,NEW.sync_revision,NEW.state,
   CASE WHEN NEW.deleted_at IS NULL THEN 'save' ELSE 'delete' END);
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.record_player_career_revision() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER record_player_career_revision AFTER INSERT OR UPDATE OF sync_revision
 ON public.player_careers FOR EACH ROW EXECUTE FUNCTION public.record_player_career_revision();
NOTIFY pgrst, 'reload schema';
