-- No client in this repository uses Supabase GraphQL; the app uses PostgREST.
-- Keep table grants for the existing REST/RLS model while removing the unused
-- GraphQL entry point from public and authenticated roles.
REVOKE USAGE ON SCHEMA graphql_public FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION graphql_public.graphql(text, text, jsonb, jsonb) FROM anon, authenticated;
