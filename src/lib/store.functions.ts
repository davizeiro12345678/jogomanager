import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PurchaseResult {
  ok: true;
  coins: number;
  seasonPass: boolean;
  reference: string;
}

/**
 * Runs the actual payment. Right now there is no card processor connected,
 * so this simply "approves" the purchase instantly — clearly labelled to the
 * player as a test payment. Swapping this for a real gateway (Stripe, Pagar.me,
 * etc.) later only requires changing this one function.
 */
async function processTestPayment(input: {
  userId: string;
  productKey: string;
  amountCents: number;
}): Promise<{ approved: true; reference: string }> {
  const reference = `test_${input.userId.slice(0, 8)}_${Date.now()}`;
  return { approved: true, reference };
}

/**
 * Records a purchase of a store product and credits the wallet accordingly.
 * Store products are limited to coins, scouting reports, training boosts and
 * cosmetics — nothing purchasable affects match results.
 */
export const purchaseProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productKey: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: product, error: productError } = await context.supabase
      .from("store_products")
      .select("key, name, price_cents, currency, coins, kind, active")
      .eq("key", data.productKey)
      .eq("active", true)
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Produto indisponível.");

    const payment = await processTestPayment({
      userId: context.userId,
      productKey: product.key,
      amountCents: product.price_cents,
    });
    if (!payment.approved) throw new Error("Pagamento não aprovado.");

    const { error: purchaseError } = await context.supabase.from("user_purchases").insert({
      user_id: context.userId,
      product_key: product.key,
      amount_cents: product.price_cents,
      status: "completed",
      reference: payment.reference,
    });
    if (purchaseError) throw new Error(purchaseError.message);

    const { data: existingWallet, error: walletFetchError } = await context.supabase
      .from("user_wallet")
      .select("coins, season_pass")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (walletFetchError) throw new Error(walletFetchError.message);

    const currentCoins = existingWallet?.coins ?? 0;
    const currentSeasonPass = existingWallet?.season_pass ?? false;
    const nextCoins = currentCoins + product.coins;
    const nextSeasonPass = currentSeasonPass || product.kind === "season_pass";

    const { data: wallet, error: walletError } = await context.supabase
      .from("user_wallet")
      .upsert(
        {
          user_id: context.userId,
          coins: nextCoins,
          season_pass: nextSeasonPass,
        },
        { onConflict: "user_id" },
      )
      .select("coins, season_pass")
      .single();
    if (walletError) throw new Error(walletError.message);

    return {
      ok: true,
      coins: wallet.coins,
      seasonPass: wallet.season_pass,
      reference: payment.reference,
    } satisfies PurchaseResult;
  });
