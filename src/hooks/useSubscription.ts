import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuthUserId } from "@/hooks/useAuthUserId";

export interface SubscriptionRow {
  id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  price_id: string;
}

/** Choose the entitlement that stays valid furthest into the future. Multiple
 * Stripe events can briefly coexist while a customer upgrades or retries. */
export function selectEffectiveSubscription(
  rows: readonly SubscriptionRow[],
  now = new Date(),
): SubscriptionRow | null {
  const active = rows.filter((row) => isSubscriptionActive(row, now));
  if (active.length === 0) return null;
  return active.reduce((best, candidate) => {
    const bestEnd = best.current_period_end
      ? new Date(best.current_period_end).getTime()
      : Infinity;
    const candidateEnd = candidate.current_period_end
      ? new Date(candidate.current_period_end).getTime()
      : Infinity;
    return candidateEnd > bestEnd ? candidate : best;
  });
}

export function useSubscription() {
  const userId = useAuthUserId();
  let environment: ReturnType<typeof getStripeEnvironment> | null = null;
  try {
    environment = getStripeEnvironment();
  } catch {
    /* availability is shown by the store */
  }
  return useQuery({
    queryKey: ["subscription", userId, environment],
    enabled: typeof userId === "string" && environment !== null,
    queryFn: async () => {
      if (!userId || !environment) return null;

      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, status, current_period_end, cancel_at_period_end, price_id")
        .eq("user_id", userId)
        .eq("environment", environment)
        .order("current_period_end", { ascending: false })
        .limit(20);

      if (error) throw new Error(error.message);
      return selectEffectiveSubscription((data ?? []) as SubscriptionRow[]);
    },
  });
}

export function isSubscriptionActive(
  sub: SubscriptionRow | null | undefined,
  now = new Date(),
): boolean {
  if (!sub) return false;
  if (["active", "trialing"].includes(sub.status)) {
    if (!sub.current_period_end) return true;
    return new Date(sub.current_period_end) > now;
  }
  if (sub.status === "canceled") {
    if (!sub.current_period_end) return false;
    return new Date(sub.current_period_end) > now;
  }
  return false;
}
