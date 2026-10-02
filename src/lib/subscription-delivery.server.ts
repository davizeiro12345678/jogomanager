/** Inputs come from authenticated RLS queries, after Stripe session ownership is verified. */
export function isSeasonPassDelivered({
  subscription,
  wallet,
  userId,
  subscriptionId,
  environment,
  now = Date.now(),
}: {
  subscription: {
    user_id: string;
    stripe_subscription_id: string;
    environment: string;
    status: string;
    current_period_end: string | null;
  } | null;
  wallet: { season_pass: boolean; season_pass_until: string | null } | null;
  userId: string;
  subscriptionId: string;
  environment: string;
  now?: number;
}) {
  return Boolean(
    subscription &&
    wallet &&
    subscription.user_id === userId &&
    subscription.stripe_subscription_id === subscriptionId &&
    subscription.environment === environment &&
    ["active", "trialing", "canceled"].includes(subscription.status) &&
    subscription.current_period_end &&
    Date.parse(subscription.current_period_end) > now &&
    wallet.season_pass &&
    wallet.season_pass_until &&
    Date.parse(wallet.season_pass_until) > now,
  );
}
