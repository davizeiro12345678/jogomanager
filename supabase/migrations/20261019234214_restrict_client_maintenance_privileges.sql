-- Explicit transaction for Supabase CLI replay.
-- Recorded SQL: supabase/migration-archive/recorded/20261019234214_restrict_client_maintenance_privileges.sql
BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLE public.player_careers, public.push_subscriptions FROM authenticated;
DO $verify$
DECLARE t regclass;
BEGIN
 FOREACH t IN ARRAY ARRAY['public.player_careers'::regclass,'public.push_subscriptions'::regclass] LOOP
  IF has_table_privilege('authenticated',t,'TRUNCATE') OR has_table_privilege('authenticated',t,'TRIGGER') OR has_table_privilege('authenticated',t,'REFERENCES') OR has_table_privilege('authenticated',t,'MAINTAIN') THEN
   RAISE EXCEPTION 'Client still has maintenance privileges';
  END IF;
 END LOOP;
 IF NOT has_table_privilege('authenticated','public.player_careers','SELECT') OR has_table_privilege('authenticated','public.player_careers','INSERT') OR has_table_privilege('authenticated','public.player_careers','UPDATE') OR has_table_privilege('authenticated','public.player_careers','DELETE') THEN
  RAISE EXCEPTION 'Career application privileges changed unexpectedly';
 END IF;
 IF NOT has_table_privilege('authenticated','public.push_subscriptions','SELECT') OR NOT has_table_privilege('authenticated','public.push_subscriptions','INSERT') OR NOT has_table_privilege('authenticated','public.push_subscriptions','UPDATE') OR NOT has_table_privilege('authenticated','public.push_subscriptions','DELETE') THEN
  RAISE EXCEPTION 'Push application privileges changed unexpectedly';
 END IF;
END $verify$;

COMMIT;
