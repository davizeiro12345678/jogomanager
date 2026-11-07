import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PurchaseRow {
  id: string;
  productKey: string;
  amountCents: number;
  status: string;
  error: string | null;
  createdAt: string;
  paymentReview?: "payment_failed" | "refund_review" | null;
  refundedAmountCents?: number;
}

export interface PurchasesSummary {
  purchases: PurchaseRow[];
  totalSpentCents: number;
  completedCount: number;
  pendingCount: number;
  coins: number;
  seasonPass: boolean;
  seasonPassUntil: string | null;
}

/** Histórico de compras do usuário logado (RLS garante que é só o dele). */
export const getPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PurchasesSummary> => {
    const [{ data: rows, error }, { data: wallet, error: walletError }] = await Promise.all([
      context.supabase
        .from("user_purchases")
        .select("id, product_key, amount_cents, status, error, reference, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("user_wallet")
        .select("coins, season_pass, season_pass_until")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);

    if (error || walletError) {
      console.error("getPurchases failed", error ?? walletError);
      throw new Error("Não foi possível carregar suas compras agora.");
    }

    const references = (rows ?? [])
      .map((row) => row.reference)
      .filter((reference): reference is string => reference !== null);
    const reviews = references.length
      ? await context.supabase
          .from("purchase_payment_reviews")
          .select("reference, review_status, refunded_amount_cents")
          .in("reference", references)
      : { data: [], error: null };
    if (reviews.error) throw new Error("Não foi possível carregar a revisão dos pagamentos agora.");
    const reviewByReference = new Map(
      (reviews.data ?? []).map((review) => [review.reference, review]),
    );
    const purchases: PurchaseRow[] = (rows ?? []).map((r) => ({
      id: r.id,
      productKey: r.product_key,
      amountCents: r.amount_cents,
      status: r.status,
      error: r.error ? "A entrega desta compra precisa de revisão." : null,
      createdAt: r.created_at,
      paymentReview: r.reference
        ? ((reviewByReference.get(r.reference)?.review_status as PurchaseRow["paymentReview"]) ??
          null)
        : null,
      refundedAmountCents: r.reference
        ? (reviewByReference.get(r.reference)?.refunded_amount_cents ?? 0)
        : 0,
    }));

    const until = wallet?.season_pass_until;
    const seasonPassUntil =
      wallet?.season_pass && until && Date.parse(until) > Date.now() ? until : null;
    return {
      purchases,
      totalSpentCents: purchases
        .filter((p) => p.status === "completed")
        .reduce((sum, p) => sum + p.amountCents, 0),
      completedCount: purchases.filter((p) => p.status === "completed").length,
      pendingCount: purchases.filter((p) => p.status === "pending").length,
      coins: wallet?.coins ?? 0,
      seasonPass: seasonPassUntil !== null,
      seasonPassUntil,
    };
  });
