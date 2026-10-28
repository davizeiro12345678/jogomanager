-- Disposable database only; no payment or wallet is created.
BEGIN;
INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
VALUES ('44444444-4444-4444-8444-444444444449', 'dispute-test@example.invalid', '{}', now());
INSERT INTO public.checkout_session_owners (session_id, user_id, environment)
VALUES ('cs_test_1', '44444444-4444-4444-8444-444444444449', 'sandbox');
DO $contract$
BEGIN
 ASSERT NOT has_table_privilege('authenticated', 'public.purchase_dispute_reviews', 'SELECT');
 ASSERT NOT has_function_privilege('authenticated',
   'public.reconcile_purchase_dispute(text,text,text,text,bigint,text,text,bigint)', 'EXECUTE');
 ASSERT has_function_privilege('service_role',
   'public.reconcile_purchase_dispute(text,text,text,text,bigint,text,text,bigint)', 'EXECUTE');
END;
$contract$;
SET LOCAL ROLE service_role;
SELECT public.reconcile_purchase_dispute('dp_test_1','cs_test_1','sandbox','needs_response',500,'brl','evt_1',100);
SELECT public.reconcile_purchase_dispute('dp_other','cs_other_app','sandbox','needs_response',500,'brl','evt_other',100);
SELECT public.reconcile_purchase_dispute('dp_test_1','cs_test_1','sandbox','won',500,'brl','evt_2',200);
SELECT public.reconcile_purchase_dispute('dp_test_1','cs_test_1','sandbox','needs_response',500,'brl','evt_1',100);
DO $behavior$
BEGIN
 ASSERT (SELECT status FROM public.purchase_dispute_reviews WHERE dispute_id = 'dp_test_1') = 'won',
   'Older events must not replace the newest reviewed state';
 ASSERT NOT EXISTS (SELECT 1 FROM public.purchase_dispute_reviews WHERE dispute_id = 'dp_other'),
   'Disputes outside registered application checkouts must not be stored';
 BEGIN
  PERFORM public.reconcile_purchase_dispute('dp_test_1','cs_test_other','sandbox','lost',500,'brl','evt_3',300);
  RAISE EXCEPTION 'A dispute changed its checkout reference';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'dispute_reference_mismatch' THEN RAISE; END IF;
 END;
END;
$behavior$;
RESET ROLE;
ROLLBACK;
