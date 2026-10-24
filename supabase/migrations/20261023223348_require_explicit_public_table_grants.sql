-- Future application tables must opt in to API access alongside their RLS.
-- Existing tables, policies, RPCs and service_role defaults are unchanged.
-- Scope to the application migration owner; do not change managed Supabase roles.
BEGIN;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
COMMIT;
