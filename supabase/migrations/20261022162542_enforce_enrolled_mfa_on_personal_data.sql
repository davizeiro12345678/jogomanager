-- AAL2 is required only for accounts that have a verified MFA factor.
-- Existing ownership policies remain mandatory: RESTRICTIVE policies only narrow access.
set lock_timeout = '3s';
create schema if not exists app_private;
create or replace function app_private.mfa_session_allowed()
returns boolean language sql stable security definer set search_path = ''
as $mfa$
 select (select auth.uid()) is not null and (
  coalesce((select auth.jwt())->>'aal', 'aal1') = 'aal2'
  or not exists (
   select 1 from auth.mfa_factors f
   where f.user_id = (select auth.uid()) and f.status = 'verified'
  )
 );
$mfa$;
revoke all on function app_private.mfa_session_allowed() from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.mfa_session_allowed() to authenticated;
comment on function app_private.mfa_session_allowed() is
 'Returns only the caller MFA gate, using Auth-managed verified factors and signed JWT assurance. Not exposed as a public RPC.';

do $policies$
declare t text;
begin
 foreach t in array array[
  'profiles','player_profiles','careers','player_careers','player_career_revisions',
  'subscriptions','user_purchases','user_wallet','wallet_item_log','user_entitlements',
  'user_achievements','user_boosts','user_cosmetic_grants','user_equipped_cosmetics',
  'coupon_redemptions','entitlement_ledger','purchase_payment_reviews',
  'push_subscriptions','user_blocks','chat_reports'
 ] loop
  execute format('create policy enrolled_mfa_required on public.%I as restrictive for all to authenticated using ((select app_private.mfa_session_allowed())) with check ((select app_private.mfa_session_allowed()))', t);
 end loop;
end;
$policies$;

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
  IF NOT app_private.mfa_session_allowed() THEN
    RAISE EXCEPTION 'MFA verification required' USING ERRCODE = '28000';
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
