set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- The Stripe schema is managed in production; fresh local CI lacks it.
-- Only create this index if the Stripe integration is installed.
DO $$
BEGIN
  IF to_regclass('stripe._managed_webhooks') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_managed_webhooks_account_id ON stripe._managed_webhooks (account_id)';
  END IF;
END
$$;

-- Optional query-diagnostic extensions may not ship in local Postgres.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'hypopg') THEN
    CREATE EXTENSION IF NOT EXISTS hypopg WITH SCHEMA extensions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'index_advisor') THEN
    CREATE EXTENSION IF NOT EXISTS index_advisor WITH SCHEMA extensions;
  END IF;
END
$$;
