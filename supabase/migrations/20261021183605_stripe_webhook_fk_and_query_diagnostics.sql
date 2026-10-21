set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- Cover the account foreign key used by the existing Stripe integration.
create index if not exists idx_managed_webhooks_account_id
  on stripe._managed_webhooks (account_id);

-- On-demand query diagnostics; no scheduled jobs or external transfers.
create extension if not exists hypopg with schema extensions;
create extension if not exists index_advisor with schema extensions;
