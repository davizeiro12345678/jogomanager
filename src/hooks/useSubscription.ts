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
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw new Error(error.message);
      return selectEffectiveSubscription(data as SubscriptionRow[] | null);
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

/** Webhook arrival order cannot shorten an independently valid subscription. */
export function selectEffectiveSubscription(
  rows: readonly SubscriptionRow[] | null,
  now = new Date(),
): SubscriptionRow | null {
  let selected: SubscriptionRow | null = null;
  let furthest = -Infinity;
  for (const row of rows ?? []) {
    if (!isSubscriptionActive(row, now)) continue;
    const end = row.current_period_end ? Date.parse(row.current_period_end) : Infinity;
    if (end > furthest) {
      selected = row;
      furthest = end;
    }
  }
  return selected;
}
