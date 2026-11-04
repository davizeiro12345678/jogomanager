-- Disposable Supabase replay only; no production connections or persistent fixtures.
\getenv disposable JM_DISPOSABLE_RLS_TEST
\if :{?disposable}
\else
  \echo 'REFUSED: set JM_DISPOSABLE_RLS_TEST=true in isolated CI only'
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
  ASSERT to_regclass('public.career_risk_signals') IS NOT NULL,
    'risk table missing after migration replay';
  ASSERT to_regprocedure('public.career_risk_score(uuid)') IS NOT NULL,
    'risk scoring RPC missing after migration replay';
  ASSERT (SELECT NOT prosecdef FROM pg_proc
          WHERE oid = 'public.career_risk_score(uuid)'::regprocedure),
    'risk scorer must be SECURITY INVOKER';
  ASSERT NOT has_table_privilege('anon', 'public.career_risk_signals', 'SELECT'),
    'anonymous role can read private risk signals';
  ASSERT NOT has_table_privilege('authenticated', 'public.career_risk_signals', 'SELECT'),
    'signed-in user can read private risk signals';
  ASSERT NOT has_table_privilege('authenticated', 'public.career_risk_signals', 'INSERT'),
    'signed-in user can forge risk signals';
  ASSERT NOT has_function_privilege('anon', 'public.career_risk_score(uuid)', 'EXECUTE'),
    'anonymous role can call privileged risk score';
  ASSERT NOT has_function_privilege('authenticated', 'public.career_risk_score(uuid)', 'EXECUTE'),
    'signed-in user can call privileged risk score';
  ASSERT has_function_privilege('service_role', 'public.career_risk_score(uuid)', 'EXECUTE'),
    'backend cannot call risk scorer';
END
$preflight$;

INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
  ('88888888-8888-4888-8888-888888888881','risk-a@example.invalid','{}',now()),
  ('88888888-8888-4888-8888-888888888882','risk-b@example.invalid','{}',now());

INSERT INTO public.career_risk_signals (user_id, reason, points, created_at) VALUES
  ('88888888-8888-4888-8888-888888888881','goals',30,now()),
  ('88888888-8888-4888-8888-888888888881','budget',40,now() - interval '1 day'),
  ('88888888-8888-4888-8888-888888888881','season_pace',25,now() - interval '45 days'),
  ('88888888-8888-4888-8888-888888888882','trophies',80,now());

DO $score$
BEGIN
  ASSERT public.career_risk_score('88888888-8888-4888-8888-888888888881') = 70,
    'older signals must expire from 30-day risk score';
  ASSERT public.career_risk_score('88888888-8888-4888-8888-888888888882') = 80,
    'second user score mismatch';
  ASSERT public.career_risk_score('88888888-8888-4888-8888-888888888883') = 0,
    'missing user score must be zero';
END
$score$;
ROLLBACK;
