import { createClient } from "@supabase/supabase-js";
import type { StripeEnv } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!
    );
  }
  return _supabase;
}

export interface ProductEffect {
  coins: number;
  scoutReports: number;
  trainingBoosts: number;
  themes: string[];
}

const EFFECTS: Record<string, ProductEffect> = {
  coins_starter: { coins: 200, scoutReports: 0, trainingBoosts: 0, themes: [] },
  coins_small: { coins: 500, scoutReports: 0, trainingBoosts: 0, themes: [] },
  coins_medium: { coins: 1800, scoutReports: 0, trainingBoosts: 0, themes: [] },
  coins_large: { coins: 4000, scoutReports: 0, trainingBoosts: 0, themes: [] },
  scout_pack: { coins: 0, scoutReports: 10, trainingBoosts: 0, themes: [] },
  training_pack: { coins: 0, scoutReports: 0, trainingBoosts: 1, themes: [] },
  theme_pack: {
    coins: 0,
    scoutReports: 0,
    trainingBoosts: 0,
    themes: ["premium_gold", "premium_carbon", "neon_stadium"],
  },
  celebration_pack: {
    coins: 0,
    scoutReports: 0,
    trainingBoosts: 0,
    themes: ["celebration_extra"],
  },
  stadium_pack: {
    coins: 0,
    scoutReports: 0,
    trainingBoosts: 0,
    themes: ["stadium_mow", "stadium_tifo"],
  },
};


export function getProductEffect(productKey: string): ProductEffect | null {
  return EFFECTS[productKey] ?? null;
}

/** Marca a compra como pendente assim que o pagamento é iniciado/recebido. */
export async function recordPendingPurchase(
  userId: string,
  productKey: string,
  reference: string,
  amountCents: number
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("user_purchases").upsert(
    {
      user_id: userId,
      product_key: productKey,
      amount_cents: amountCents,
      status: "pending",
      reference,
    } as any,
    { onConflict: "reference", ignoreDuplicates: true }
  );
  if (error) console.error("recordPendingPurchase falhou", error.message);
}

/** Registra falha de pagamento para aparecer no painel de compras. */
export async function markPurchaseFailed(
  reference: string,
  message: string
): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("user_purchases")
    .update({ status: "failed", error: message.slice(0, 400) } as never)
    .eq("reference", reference)
    .neq("status", "completed");
}

export async function fulfillOneTimePurchase(
  userId: string,
  productKey: string,
  reference: string,
  amountCents: number
): Promise<void> {
  const effect = getProductEffect(productKey);
  if (!effect) {
    await markPurchaseFailed(reference, `Produto desconhecido: ${productKey}`);
    throw new Error(`Unknown product key: ${productKey}`);
  }

  const supabase = getSupabase();

  // Idempotência: a mesma sessão da Stripe pode chegar mais de uma vez.
  const { data: existing } = await supabase
    .from("user_purchases")
    .select("id, status")
    .eq("reference", reference)
    .maybeSingle();
  if ((existing as { status?: string } | null)?.status === "completed") return;

  const { error: purchaseError } = await supabase.from("user_purchases").upsert(
    {
      user_id: userId,
      product_key: productKey,
      amount_cents: amountCents,
      status: "completed",
      error: null,
      reference,
    } as any,
    { onConflict: "reference" }
  );
  if (purchaseError) throw new Error(purchaseError.message);

  const { data: rawWallet, error: walletFetchError } = await supabase
    .from("user_wallet")
    .select("coins, scout_reports, training_boosts, unlocked_themes")
    .eq("user_id", userId)
    .maybeSingle();
  const existingWallet = rawWallet as {
    coins: number;
    scout_reports: number;
    training_boosts: number;
    unlocked_themes: string[];
  } | null;
  if (walletFetchError) throw new Error(walletFetchError.message);

  const currentThemes = new Set<string>(existingWallet?.unlocked_themes ?? []);
  for (const theme of effect.themes) currentThemes.add(theme);

  const nextCoins = (existingWallet?.coins ?? 0) + effect.coins;
  const nextScout = (existingWallet?.scout_reports ?? 0) + effect.scoutReports;
  const nextTraining =
    (existingWallet?.training_boosts ?? 0) + effect.trainingBoosts;

  const { error: walletError } = await supabase.from("user_wallet").upsert(
    {
      user_id: userId,
      coins: nextCoins,
      scout_reports: nextScout,
      training_boosts: nextTraining,
      unlocked_themes: Array.from(currentThemes),
    } as any,
    { onConflict: "user_id" }
  );
  if (walletError) throw new Error(walletError.message);
}


export async function syncSubscription(
  subscription: any,
  env: StripeEnv
): Promise<void> {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    throw new Error("No userId in subscription metadata");
  }

  const item = subscription.items?.data?.[0];
  const priceId =
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id;
  const productId = item?.price?.product;
  const periodStart =
    item?.current_period_start ?? subscription.current_period_start;
  const periodEnd =
    item?.current_period_end ?? subscription.current_period_end;

  const supabase = getSupabase();

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart
        ? new Date(periodStart * 1000).toISOString()
        : null,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: "stripe_subscription_id" }
  );

  // Mirror active subscription into wallet.season_pass_until
  const active =
    ["active", "trialing"].includes(subscription.status) &&
    periodEnd &&
    new Date(periodEnd * 1000) > new Date();
  const canceledButValid =
    subscription.status === "canceled" &&
    periodEnd &&
    new Date(periodEnd * 1000) > new Date();

  const seasonPassUntil =
    active || canceledButValid
      ? new Date(periodEnd * 1000).toISOString()
      : null;

  await supabase
    .from("user_wallet")
    .upsert(
      {
        user_id: userId,
        season_pass: !!seasonPassUntil,
        season_pass_until: seasonPassUntil,
      } as any,
      { onConflict: "user_id" }
    );
}
