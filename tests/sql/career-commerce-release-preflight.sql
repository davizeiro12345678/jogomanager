-- Read-only release preflight: no fixtures, schema changes or customer data.
-- Run against the intended target immediately before deploying the matching app.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
WITH contracts(name, object_id) AS (
  VALUES
    ('career_risk_score', to_regprocedure('public.career_risk_score(uuid)')::oid),
    ('fulfill_store_purchase', to_regprocedure('public.fulfill_store_purchase(uuid,text,text,integer,integer,integer,integer,text[],integer,integer)')::oid),
    ('spend_coins_on_service', to_regprocedure('public.spend_coins_on_service(uuid,text,uuid)')::oid)
)
SELECT name, object_id IS NOT NULL AS present,
  COALESCE(has_function_privilege('anon', object_id, 'EXECUTE'), false) AS anon_has_access,
  COALESCE(has_function_privilege('authenticated', object_id, 'EXECUTE'), false) AS authenticated_has_access,
  COALESCE(has_function_privilege('service_role', object_id, 'EXECUTE'), false) AS service_role_has_access,
  NULL::boolean AS rls_enabled
FROM contracts
UNION ALL
SELECT 'career_risk_signals_rls', c.oid IS NOT NULL,
  COALESCE(has_table_privilege('anon', c.oid, 'SELECT'), false),
  COALESCE(has_table_privilege('authenticated', c.oid, 'SELECT'), false),
  COALESCE(has_table_privilege('service_role', c.oid, 'SELECT'), false),
  COALESCE(c.relrowsecurity, false)
FROM (SELECT to_regclass('public.career_risk_signals')::oid AS oid) x
LEFT JOIN pg_class c ON c.oid = x.oid
ORDER BY name;
ROLLBACK;
