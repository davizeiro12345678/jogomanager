-- Applied to production through the Supabase migration API on 2026-10-21.
-- The managed Stripe integration is installed only in production. Local CI has
-- no stripe schema, so replay must skip absent extension-owned functions.
-- Existing functions retain the production hardening: pg_catalog search_path.
DO $$
BEGIN
  IF to_regprocedure('stripe.set_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION stripe.set_updated_at() SET search_path = pg_catalog;
  END IF;
  IF to_regprocedure('stripe.set_updated_at_metadata()') IS NOT NULL THEN
    ALTER FUNCTION stripe.set_updated_at_metadata() SET search_path = pg_catalog;
  END IF;
  IF to_regprocedure('stripe.check_rate_limit(text,integer,integer)') IS NOT NULL THEN
    ALTER FUNCTION stripe.check_rate_limit(text, integer, integer) SET search_path = pg_catalog;
  END IF;
END;
$$;
