-- Run only on a disposable or preview database; all fixtures are rolled back.
BEGIN;
INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
 ('00000000-0000-4000-8fff-260011040001', 'rls-a-20261104@example.invalid', '{}'::jsonb, now()),
 ('00000000-0000-4000-8fff-260011040002', 'rls-b-20261104@example.invalid', '{}'::jsonb, now());
INSERT INTO public.careers(user_id, state) VALUES
 ('00000000-0000-4000-8fff-260011040001', '{"fixture":"a"}'::jsonb),
 ('00000000-0000-4000-8fff-260011040002', '{"fixture":"b"}'::jsonb);
INSERT INTO public.user_wallet(user_id, coins) VALUES
 ('00000000-0000-4000-8fff-260011040001', 10),
 ('00000000-0000-4000-8fff-260011040002', 20);

SET LOCAL ROLE service_role;
DO $payment$
DECLARE changed boolean; outcome text;
BEGIN
  IF NOT public.begin_payment_webhook_event('evt_codex_rollback_20261104', 'checkout.session.completed') THEN
    RAISE EXCEPTION 'First event was not accepted';
  END IF;
  IF NOT public.fulfill_store_purchase('00000000-0000-4000-8fff-260011040001', 'fixture',
    'cs_codex_rollback_20261104', 500, 111, 0, 0, ARRAY[]::text[]) THEN
    RAISE EXCEPTION 'First fulfillment failed';
  END IF;
  PERFORM public.finish_payment_webhook_event('evt_codex_rollback_20261104', true);
  IF public.begin_payment_webhook_event('evt_codex_rollback_20261104', 'checkout.session.completed') THEN
    RAISE EXCEPTION 'A completed event was accepted again';
  END IF;
  IF public.fulfill_store_purchase('00000000-0000-4000-8fff-260011040001', 'fixture',
    'cs_codex_rollback_20261104', 500, 111, 0, 0, ARRAY[]::text[]) THEN
    RAISE EXCEPTION 'A completed purchase was fulfilled again';
  END IF;

  -- The current app uses the extended ten-argument RPC. Older preview branches
  -- may have only the legacy overload; the migrated CI database tests both.
  IF to_regprocedure('public.fulfill_store_purchase(uuid,text,text,integer,integer,integer,integer,text[],integer,integer)') IS NOT NULL THEN
    EXECUTE 'SELECT public.fulfill_store_purchase($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)'
      INTO changed USING '00000000-0000-4000-8fff-260011040001'::uuid, 'fixture',
      'cs_codex_extended_20261104', 500, 222, 0, 0, ARRAY[]::text[], 2, 3;
    IF NOT changed THEN RAISE EXCEPTION 'Extended fulfillment failed'; END IF;
    EXECUTE 'SELECT public.fulfill_store_purchase($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)'
      INTO changed USING '00000000-0000-4000-8fff-260011040001'::uuid, 'fixture',
      'cs_codex_extended_20261104', 500, 222, 0, 0, ARRAY[]::text[], 2, 3;
    IF changed THEN RAISE EXCEPTION 'Extended purchase was fulfilled twice'; END IF;
    EXECUTE 'SELECT reason FROM public.spend_coins_on_service($1,$2,$3)'
      INTO outcome USING '00000000-0000-4000-8fff-260011040001'::uuid, 'injury_recovery',
      '00000000-0000-4000-8fff-260011040003'::uuid;
    IF outcome IS DISTINCT FROM 'stored_item' THEN RAISE EXCEPTION 'Stored service was not consumed'; END IF;
    EXECUTE 'SELECT reason FROM public.spend_coins_on_service($1,$2,$3)'
      INTO outcome USING '00000000-0000-4000-8fff-260011040001'::uuid, 'injury_recovery',
      '00000000-0000-4000-8fff-260011040003'::uuid;
    IF outcome IS DISTINCT FROM 'duplicate' THEN RAISE EXCEPTION 'Repeated service request was not deduplicated'; END IF;
  END IF;
END $payment$;
RESET ROLE;
DO $balances$
DECLARE expected integer := 121;
BEGIN
  IF to_regprocedure('public.fulfill_store_purchase(uuid,text,text,integer,integer,integer,integer,text[],integer,integer)') IS NOT NULL THEN
    expected := 343;
  END IF;
  IF (SELECT coins FROM public.user_wallet WHERE user_id='00000000-0000-4000-8fff-260011040001') <> expected THEN
    RAISE EXCEPTION 'Unexpected wallet balance after repeated purchase';
  END IF;
  IF (SELECT count(*) FROM public.user_purchases WHERE reference='cs_codex_rollback_20261104') <> 1 THEN
    RAISE EXCEPTION 'Legacy purchase count is not one';
  END IF;
END $balances$;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8fff-260011040001","role":"authenticated","aal":"aal2"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8fff-260011040001', true);
SET LOCAL ROLE authenticated;
DO $rls$
DECLARE n integer;
BEGIN
  IF (SELECT count(*) FROM public.careers WHERE user_id=auth.uid()) <> 1 OR
     (SELECT count(*) FROM public.user_wallet WHERE user_id=auth.uid()) <> 1 THEN
    RAISE EXCEPTION 'Owner access failed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.careers WHERE user_id='00000000-0000-4000-8fff-260011040002') OR
     EXISTS (SELECT 1 FROM public.user_wallet WHERE user_id='00000000-0000-4000-8fff-260011040002') THEN
    RAISE EXCEPTION 'Another user is readable';
  END IF;
  BEGIN
    UPDATE public.careers SET state='{"altered":true}' WHERE user_id='00000000-0000-4000-8fff-260011040002';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'Another career was modified'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.user_wallet SET coins=999999 WHERE user_id='00000000-0000-4000-8fff-260011040002';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'Another wallet was modified'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $rls$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8fff-260011040002","role":"authenticated","aal":"aal2"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8fff-260011040002', true);
SET LOCAL ROLE authenticated;
DO $rls_reverse$
BEGIN
  IF (SELECT count(*) FROM public.careers WHERE user_id=auth.uid()) <> 1 OR
     (SELECT count(*) FROM public.user_wallet WHERE user_id=auth.uid()) <> 1 OR
     EXISTS (SELECT 1 FROM public.careers WHERE user_id='00000000-0000-4000-8fff-260011040001') OR
     EXISTS (SELECT 1 FROM public.user_wallet WHERE user_id='00000000-0000-4000-8fff-260011040001') THEN
    RAISE EXCEPTION 'Reverse ownership check failed';
  END IF;
END $rls_reverse$;
RESET ROLE;
SELECT 'payment replay and RLS checks passed' AS result;
ROLLBACK;
