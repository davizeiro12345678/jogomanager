set lock_timeout = '3s';
-- Production already has the identical UNIQUE btree; preserve its constraint.
do $$ begin
 if exists (select 1 from pg_index where indexrelid=to_regclass('public.subscriptions_stripe_subscription_id_key') and indisvalid and indisunique)
 and not exists (select 1 from pg_constraint where conindid=to_regclass('public.idx_subscriptions_stripe_id')) then
  drop index if exists public.idx_subscriptions_stripe_id;
 end if;
end $$;
