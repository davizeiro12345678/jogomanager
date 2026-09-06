import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

export interface SubscriptionRow {
  id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  price_id: string;
}

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription", getStripeEnvironment()],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) return null;

      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, status, current_period_end, cancel_at_period_end, price_id")
        .eq("user_id", userId)
        .eq("environment", getStripeEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data as SubscriptionRow | null;
    },
  });
}

export function isSubscriptionActive(sub: SubscriptionRow | null | undefined): boolean {
  if (!sub) return false;
  if (["active", "trialing"].includes(sub.status)) {
    if (!sub.current_period_end) return true;
    return new Date(sub.current_period_end) > new Date();
  }
  if (sub.status === "canceled") {
    if (!sub.current_period_end) return false;
    return new Date(sub.current_period_end) > new Date();
  }
  return false;
}
