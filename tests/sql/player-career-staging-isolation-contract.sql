-- Run only against the isolated, disposable staging database.
-- Uses actual deployed RPC/RLS; JWT claims are simulated in SQL, not a login.
-- All fixtures are rolled back. Never run this contract in production.
BEGIN;
SET LOCAL statement_timeout='20s';
SET LOCAL plpgsql.check_asserts=on;
SELECT set_config('jm.qa.user_a',gen_random_uuid()::text,true),set_config('jm.qa.user_b',gen_random_uuid()::text,true);
INSERT INTO auth.users(id,email,email_confirmed_at) SELECT id,id::text||'@example.invalid',now() FROM (SELECT current_setting('jm.qa.user_a')::uuid AS id UNION ALL SELECT current_setting('jm.qa.user_b')::uuid) s;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('jm.qa.user_a'),true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('jm.qa.user_a'),'role','authenticated','aal','aal1')::text,true);
DO $qa$
DECLARE s text; r bigint; st jsonb:='{"version":1,"slot":1,"seed":"qa","season":1,"week":1}'::jsonb;
BEGIN
 ASSERT NOT has_table_privilege(current_user,'public.player_careers','INSERT');
 SELECT status,new_revision INTO s,r FROM public.mutate_player_career(1,0,'save',st);
 ASSERT (s,r)=('applied',1::bigint);
 SELECT status,new_revision INTO s,r FROM public.mutate_player_career(1,0,'save',st);
 ASSERT (s,r)=('conflict',1::bigint);
 SELECT status,new_revision INTO s,r FROM public.mutate_player_career(1,1,'save',st||'{"week":2}'::jsonb);
 ASSERT (s,r)=('applied',2::bigint);
 SELECT status,new_revision INTO s,r FROM public.mutate_player_career(1,2,'save',st);
 ASSERT (s,r)=('conflict',2::bigint);
END $qa$;
SELECT set_config('request.jwt.claim.sub',current_setting('jm.qa.user_b'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('jm.qa.user_b'),'role','authenticated','aal','aal1')::text,true);
DO $qa$
DECLARE s text; r bigint;
BEGIN
 ASSERT NOT EXISTS(SELECT 1 FROM public.player_careers WHERE user_id=current_setting('jm.qa.user_a')::uuid);
 SELECT status,new_revision INTO s,r FROM public.mutate_player_career(1,2,'delete');
 ASSERT (s,r)=('conflict',0::bigint);
END $qa$;
SELECT set_config('request.jwt.claim.sub',current_setting('jm.qa.user_a'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('jm.qa.user_a'),'role','authenticated','aal','aal1')::text,true);
DO $qa$
DECLARE s text; r bigint;
BEGIN
 ASSERT (SELECT sync_revision FROM public.player_careers WHERE slot=1)=2;
 SELECT status,new_revision INTO s,r FROM public.mutate_player_career(1,2,'delete');
 ASSERT (s,r)=('applied',3::bigint);
 SELECT status,new_revision INTO s,r FROM public.mutate_player_career(1,2,'save','{"version":1,"slot":1,"seed":"qa","season":1,"week":2}'::jsonb);
 ASSERT (s,r)=('conflict',3::bigint);
END $qa$;
RESET ROLE;
ROLLBACK;
