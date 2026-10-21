-- Applied to production through the Supabase migration API on 2026-10-21.
-- These helpers use built-ins and schema-qualified stripe tables only.
-- Pin resolution to pg_catalog to avoid caller-controlled object lookup.
ALTER FUNCTION stripe.set_updated_at() SET search_path = pg_catalog;
ALTER FUNCTION stripe.set_updated_at_metadata() SET search_path = pg_catalog;
ALTER FUNCTION stripe.check_rate_limit(text, integer, integer) SET search_path = pg_catalog;
