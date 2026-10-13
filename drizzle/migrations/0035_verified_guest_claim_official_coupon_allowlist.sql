-- Security remediation, 2026-10-13: match the changes applied to the live database.
-- Allowlist intended recipients without disclosing them to the client.
CREATE TABLE IF NOT EXISTS public.coupon_eligible_users (
 code text NOT NULL REFERENCES public.game_coupons(code) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(code,user_id)
);
ALTER TABLE public.coupon_eligible_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coupon_eligible_users FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.coupon_eligible_users TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_game_coupon(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
 _uid uuid := auth.uid();
 _c public.game_coupons%ROWTYPE;
 _norm text := upper(regexp_replace(coalesce(_code, ''), '\s', '', 'g'));
BEGIN
 IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','login'); END IF;
 IF length(_norm)<3 OR length(_norm)>24 OR _norm !~ '^[A-Z0-9]+$' THEN
   RETURN jsonb_build_object('ok',false,'reason','invalid');
 END IF;
 IF _norm IN ('JOGOMANAGER','CRIADOR') AND NOT EXISTS (
    SELECT 1 FROM public.coupon_eligible_users a
    WHERE a.code=_norm AND a.user_id=_uid
      AND (a.expires_at IS NULL OR a.expires_at > now())
 ) THEN
   RETURN jsonb_build_object('ok',false,'reason','not_eligible');
 END IF;
 SELECT * INTO _c FROM public.game_coupons WHERE code=_norm FOR UPDATE;
 IF NOT FOUND OR NOT _c.active THEN RETURN jsonb_build_object('ok',false,'reason','invalid'); END IF;
 IF (_c.starts_at IS NOT NULL AND now()<_c.starts_at)
  OR (_c.ends_at IS NOT NULL AND now()>_c.ends_at)
   THEN RETURN jsonb_build_object('ok',false,'reason','expired');
 END IF;
 IF _c.max_redemptions IS NOT NULL AND _c.redemption_count>=_c.max_redemptions
   THEN RETURN jsonb_build_object('ok',false,'reason','sold_out');
 END IF;
 INSERT INTO public.coupon_redemptions(user_id,code) VALUES(_uid,_norm) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','used'); END IF;
 UPDATE public.game_coupons SET redemption_count=redemption_count+1 WHERE code=_norm;
 INSERT INTO public.user_wallet(user_id,coins,scout_reports,training_boosts)
 VALUES(_uid,_c.coins,_c.scout_reports,_c.training_boosts)
 ON CONFLICT(user_id) DO UPDATE SET
 coins=user_wallet.coins+EXCLUDED.coins,
 scout_reports=user_wallet.scout_reports+EXCLUDED.scout_reports,
 training_boosts=user_wallet.training_boosts+EXCLUDED.training_boosts;
 RETURN jsonb_build_object('ok',true,'description',_c.description,
 'coins',_c.coins,'scoutReports',_c.scout_reports,'trainingBoosts',_c.training_boosts);
END $fn$;
REVOKE ALL ON FUNCTION public.redeem_game_coupon(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_game_coupon(text) TO authenticated;

-- Additional database-level defense in depth:
-- service role may reserve claims only for accounts with confirmed email.
CREATE OR REPLACE FUNCTION public.reserve_guest_checkout_claim(_intent_id uuid,_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $fn$
DECLARE
 current_owner uuid;
 current_state text;
 verified_email boolean;
BEGIN
 SELECT u.email_confirmed_at IS NOT NULL INTO verified_email
 FROM auth.users u WHERE u.id=_user_id;
 IF NOT coalesce(verified_email,false) THEN RETURN false; END IF;
 SELECT claimed_by_user_id,state INTO current_owner,current_state
 FROM public.guest_checkout_intents WHERE id=_intent_id FOR UPDATE;
 IF NOT FOUND OR (current_owner IS NOT NULL AND current_owner <> _user_id)
   THEN RETURN false; END IF;
 IF current_state='claimed' THEN RETURN current_owner=_user_id; END IF;
 UPDATE public.guest_checkout_intents
 SET state='claiming',claimed_by_user_id=_user_id,error=NULL,updated_at=now()
 WHERE id=_intent_id AND state IN ('created','checkout_open','paid','claiming','expired');
 RETURN FOUND;
END $fn$;
REVOKE ALL ON FUNCTION public.reserve_guest_checkout_claim(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_guest_checkout_claim(uuid,uuid) TO service_role;
