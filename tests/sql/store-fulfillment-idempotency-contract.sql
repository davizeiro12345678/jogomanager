-- Exercise the database calls made by the signed, one-time checkout webhook.
BEGIN;
SET LOCAL plpgsql.check_asserts = on;

SELECT set_config('jogomanager.test.store_user', gen_random_uuid()::text, true);
INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
SELECT id, id::text || '@example.invalid', '{}'::jsonb, now()
FROM (SELECT current_setting('jogomanager.test.store_user')::uuid AS id) AS fixture;

SET LOCAL ROLE service_role;
DO $contract$
DECLARE
  buyer uuid := current_setting('jogomanager.test.store_user')::uuid;
  checkout_ref text := 'cs_test_contract_' || buyer::text;
  event_ref text := 'evt_contract_' || buyer::text;
  purchased_theme text := 'fixture_theme';
  wallet public.user_wallet%ROWTYPE;
BEGIN
  INSERT INTO public.user_wallet (user_id) VALUES (buyer) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO STRICT wallet FROM public.user_wallet WHERE user_id = buyer;
  ASSERT (wallet.coins, wallet.scout_reports, wallet.training_boosts, wallet.injury_treatments, wallet.opponent_reports)
    = (0, 0, 0, 0, 0), 'fixture wallet must start empty';

  ASSERT public.begin_payment_webhook_event(event_ref, 'checkout.session.completed') IS TRUE,
    'the first webhook delivery must be claimed';
  INSERT INTO public.user_purchases (user_id, product_key, reference, amount_cents, status)
  VALUES (buyer, 'coins_small', checkout_ref, 490, 'pending');
  ASSERT public.fulfill_store_purchase(buyer, 'coins_small', checkout_ref, 490, 200, 3, 4, ARRAY[purchased_theme], 1, 2) IS TRUE,
    'the pending purchase must complete';
  PERFORM public.finish_payment_webhook_event(event_ref, true);

  ASSERT public.begin_payment_webhook_event(event_ref, 'checkout.session.completed') IS FALSE,
    'a completed event must reject redelivery';
  ASSERT public.fulfill_store_purchase(buyer, 'coins_small', checkout_ref, 490, 200, 3, 4, ARRAY[purchased_theme], 1, 2) IS FALSE,
    'the checkout reference must prevent duplicate credits independently of the webhook receipt';
  PERFORM public.finish_payment_webhook_event(event_ref, false);

  SELECT * INTO STRICT wallet FROM public.user_wallet WHERE user_id = buyer;
  ASSERT (wallet.coins, wallet.scout_reports, wallet.training_boosts, wallet.injury_treatments, wallet.opponent_reports)
    = (200, 3, 4, 1, 2), 'each purchased balance must be credited exactly once';
  ASSERT (SELECT count(*) FROM unnest(wallet.unlocked_themes) AS theme WHERE theme = purchased_theme) = 1,
    'the purchased theme must be present once';
  ASSERT (SELECT count(*) = 1 AND bool_and(status = 'completed' AND amount_cents = 490 AND product_key = 'coins_small' AND reference = checkout_ref)
    FROM public.user_purchases WHERE user_id = buyer), 'expected a single completed purchase';
  ASSERT (SELECT count(*) = 1 AND bool_and(status = 'completed' AND attempts = 1 AND event_type = 'checkout.session.completed')
    FROM public.payment_webhook_events WHERE event_id = event_ref), 'replay must preserve the completed receipt';
END;
$contract$;
ROLLBACK;
