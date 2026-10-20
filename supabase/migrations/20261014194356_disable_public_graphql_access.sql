-- GraphQL is unused by this client (it talks to PostgREST). Remove the default
-- PUBLIC grants as well as the role-specific grants, while retaining service
-- role access for administrative use.
REVOKE USAGE ON SCHEMA graphql_public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA graphql_public TO service_role;
REVOKE EXECUTE ON FUNCTION graphql_public.graphql(text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION graphql_public.graphql(text, text, jsonb, jsonb) TO service_role;
