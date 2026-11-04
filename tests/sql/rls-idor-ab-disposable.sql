-- Disposable local Supabase only. Run via quality.yml's local-db job.
-- Both principals and all changes are rolled back. Never connect to production.
\getenv disposable JM_DISPOSABLE_RLS_TEST
\if :{?disposable}
\else
  \echo 'REFUSED: JM_DISPOSABLE_RLS_TEST is required'
  \quit 2
\endif
\if :disposable
\else
  \echo 'REFUSED: JM_DISPOSABLE_RLS_TEST must be true'
  \quit 2
\endif
BEGIN;
DO $preflight$
BEGIN
  ASSERT current_database() = 'postgres', 'Unexpected database name';
  ASSERT to_regclass('public.careers') IS NOT NULL, 'Incomplete migrations';
  ASSERT to_regclass('public.player_careers') IS NOT NULL, 'Incomplete migrations';
  ASSERT to_regclass('public.user_wallet') IS NOT NULL, 'Incomplete migrations';
  ASSERT NOT has_table_privilege('authenticated', 'public.user_wallet', 'UPDATE'),
    'CRITICAL: users can mint wallet coins through the API';
  ASSERT NOT has_table_privilege('authenticated', 'public.user_wallet', 'INSERT'),
    'CRITICAL: users can insert wallet grants';
  ASSERT NOT has_table_privilege('authenticated', 'public.player_careers', 'INSERT'),
    'Player career CAS must remain the only write boundary';
END
$preflight$;
INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
VALUES
  ('77777777-7777-4777-8777-777777777771','rls-a@example.invalid','{}',now()),
  ('77777777-7777-4777-8777-777777777772','rls-b@example.invalid','{}',now()),
  ('77777777-7777-4777-8777-777777777773','rls-c@example.invalid','{}',now());
INSERT INTO public.careers (user_id,state)
VALUES
  ('77777777-7777-4777-8777-777777777771','{"owner":"A","season":1}'),
  ('77777777-7777-4777-8777-777777777772','{"owner":"B","season":1}');
INSERT INTO public.player_careers (user_id,slot,state)
VALUES
  ('77777777-7777-4777-8777-777777777771',1,'{"owner":"A","revision":1}'),
  ('77777777-7777-4777-8777-777777777772',1,'{"owner":"B","revision":1}');
INSERT INTO public.user_wallet (user_id,coins)
VALUES
  ('77777777-7777-4777-8777-777777777771',101),
  ('77777777-7777-4777-8777-777777777772',202);
-- These are PostgreSQL RLS/privilege contracts, not a substitute for HTTP JWT A/B tests.
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777771',true);
SELECT set_config('request.jwt.claims','{"sub":"77777777-7777-4777-8777-777777777771","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
DO $a$
DECLARE affected integer;
BEGIN
  ASSERT (SELECT count(*) FROM public.careers)=1, 'A saw career belonging to B';
  ASSERT (SELECT state->>'owner' FROM public.careers)='A', 'A career owner mismatch';
  ASSERT (SELECT count(*) FROM public.player_careers)=1, 'A saw B player career';
  ASSERT (SELECT state->>'owner' FROM public.player_careers)='A', 'A player career mismatch';
  ASSERT (SELECT count(*) FROM public.user_wallet)=1, 'A saw B wallet';
  ASSERT (SELECT coins FROM public.user_wallet)=101, 'A wallet mismatch';
  UPDATE public.careers SET state='{"tampered":true}'
    WHERE user_id='77777777-7777-4777-8777-777777777772';
  GET DIAGNOSTICS affected=ROW_COUNT;
  ASSERT affected=0, 'A modified B career';
  BEGIN
    UPDATE public.player_careers SET state='{"tampered":true}'
      WHERE user_id='77777777-7777-4777-8777-777777777772';
    GET DIAGNOSTICS affected=ROW_COUNT;
    ASSERT affected=0, 'A modified B player career';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.user_wallet SET coins=999999
      WHERE user_id='77777777-7777-4777-8777-777777777771';
    RAISE EXCEPTION 'Authenticated client can mint own coins';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.careers SET user_id='77777777-7777-4777-8777-777777777773'
      WHERE user_id='77777777-7777-4777-8777-777777777771';
    RAISE EXCEPTION 'A reassigned own career to a different user';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
END
$a$;
RESET ROLE;
-- Reauthenticate as B to ensure the result is symmetric and B's data survived.
SELECT set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777772',true);
SELECT set_config('request.jwt.claims','{"sub":"77777777-7777-4777-8777-777777777772","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
DO $b$
DECLARE affected integer;
BEGIN
  ASSERT (SELECT count(*) FROM public.careers)=1, 'B saw A career';
  ASSERT (SELECT state->>'owner' FROM public.careers)='B', 'A corrupted B career';
  ASSERT (SELECT count(*) FROM public.player_careers)=1, 'B saw A player career';
  ASSERT (SELECT state->>'owner' FROM public.player_careers)='B', 'A corrupted B player career';
  ASSERT (SELECT count(*) FROM public.user_wallet)=1, 'B saw A wallet';
  ASSERT (SELECT coins FROM public.user_wallet)=202, 'B wallet was modified';
  UPDATE public.careers SET state='{"tampered":true}'
    WHERE user_id='77777777-7777-4777-8777-777777777771';
  GET DIAGNOSTICS affected=ROW_COUNT;
  ASSERT affected=0, 'B modified A career';
END
$b$;
RESET ROLE;
DO $integrity$
BEGIN
  ASSERT (SELECT count(*) FROM public.careers WHERE user_id IN
    ('77777777-7777-4777-8777-777777777771','77777777-7777-4777-8777-777777777772'))=2,
    'A/B career rows were modified or removed';
  ASSERT (SELECT coins FROM public.user_wallet WHERE user_id='77777777-7777-4777-8777-777777777771')=101,
    'Wallet A balance changed';
  ASSERT (SELECT coins FROM public.user_wallet WHERE user_id='77777777-7777-4777-8777-777777777772')=202,
    'Wallet B balance changed';
END
$integrity$;
ROLLBACK;
\echo 'PASS: disposable database A/B RLS ownership, denial, wallet integrity and rollback'
