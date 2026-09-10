import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PurchaseRow {
  id: string;
  productKey: string;
  amountCents: number;
  status: string;
  reference: string | null;
  error: string | null;
  createdAt: string;
}

export interface PurchasesSummary {
  purchases: PurchaseRow[];
  totalSpentCents: number;
  completedCount: number;
  pendingCount: number;
  coins: number;
  seasonPass: boolean;
}

/** Histórico de compras do usuário logado (RLS garante que é só o dele). */
export const getPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PurchasesSummary> => {
    const [{ data: rows, error }, { data: wallet }] = await Promise.all([
      context.supabase
        .from("user_purchases")
        .select("id, product_key, amount_cents, status, error, reference, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("user_wallet")
        .select("coins, season_pass")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);

    if (error) throw new Error(error.message);

    const purchases: PurchaseRow[] = (rows ?? []).map((r) => ({
      id: r.id,
      productKey: r.product_key,
      amountCents: r.amount_cents,
      status: r.status,
      reference: r.reference ?? null,
      error: (r as { error: string | null }).error ?? null,
      createdAt: r.created_at,
    }));

    return {
      purchases,
      totalSpentCents: purchases
        .filter((p) => p.status === "completed")
        .reduce((sum, p) => sum + p.amountCents, 0),
      completedCount: purchases.filter((p) => p.status === "completed").length,
      pendingCount: purchases.filter((p) => p.status === "pending").length,
      coins: wallet?.coins ?? 0,
      seasonPass: wallet?.season_pass ?? false,
    };
  });
