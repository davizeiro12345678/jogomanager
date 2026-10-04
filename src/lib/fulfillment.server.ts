import type { StripeEnv } from "@/lib/stripe.server";
import type Stripe from "stripe";
import {
  getServerStoreProduct,
  getStoreServiceSupabase,
  isValidCheckoutSubtotal,
  isValidPaidAmount,
  parseStoreProductContents,
  type StoreProductContents,
} from "@/lib/store-products.server";

export type ProductEffect = StoreProductContents;

/**
 * A guest intent freezes the commercial offer that Stripe accepted. The
 * server still validates that snapshot before passing it to the atomic RPC,
 * but it must not replace a paid offer with the catalog's newer contents.
 */
export interface FulfillmentSnapshot {
  priceCents: number;
  contents: ProductEffect;
}

/**
 * Loads benefits from the same `store_products.contents` value used by the
 * server checkout validator. This deliberately avoids a second hard-coded
 * catalog that could credit a different item from the one displayed.
 */
export async function getProductEffect(productKey: string): Promise<ProductEffect> {
  const product = await getServerStoreProduct(getStoreServiceSupabase(), productKey, {
    activeOnly: false,
  });
  return product.contents;
}

/** Marks a payment as pending without ever replacing a completed credit. */
export async function recordPendingPurchase(
  userId: string,
  productKey: string,
  reference: string,
  amountCents: number,
): Promise<void> {
  const supabase = getStoreServiceSupabase();
  const { error } = await supabase.from("user_purchases").upsert(
    {
      user_id: userId,
      product_key: productKey,
      amount_cents: amountCents,
      status: "pending",
      reference,
    },
    { onConflict: "reference", ignoreDuplicates: true },
  );
  if (error) console.error("recordPendingPurchase falhou", error.message);
}

/** Registers a payment failure while retaining a completed purchase as final. */
export async function markPurchaseFailed(reference: string, message: string): Promise<void> {
  const supabase = getStoreServiceSupabase();
  const { error } = await supabase
    .from("user_purchases")
    .update({ status: "failed", error: message.slice(0, 400) })
    .eq("reference", reference)
    .neq("status", "completed");
  if (error) console.error("markPurchaseFailed falhou", error.message);
}

/**
 * Credits a one-time payment atomically. The SQL function moves a pending
 * record to completed and changes the wallet in one transaction, so webhook
 * and return-page retries cannot grant the package twice.
 */
export async function fulfillOneTimePurchase(
  userId: string,
  productKey: string,
  reference: string,
  amountCents: number,
  checkoutSubtotalCents: number,
  snapshot?: FulfillmentSnapshot,
): Promise<boolean> {
  const supabase = getStoreServiceSupabase();
  const product = snapshot
    ? null
    : await getServerStoreProduct(supabase, productKey, { activeOnly: false });
  const priceCents = snapshot?.priceCents ?? product!.priceCents;
  const contents = parseStoreProductContents(snapshot?.contents ?? product!.contents);
  if (
    !isValidCheckoutSubtotal(checkoutSubtotalCents, priceCents) ||
    !isValidPaidAmount(amountCents)
  ) {
    await markPurchaseFailed(reference, "O valor pago não confere com o catálogo oficial.");
    throw new Error(`Unexpected checkout amount for ${productKey}`);
  }
  if (!contents) {
    await markPurchaseFailed(reference, "O conteúdo pago não confere com o catálogo oficial.");
    throw new Error(`Unexpected checkout contents for ${productKey}`);
  }

  const { data, error } = await supabase.rpc("fulfill_store_purchase", {
    _user_id: userId,
    _product_key: productKey,
    _reference: reference,
    _amount_cents: amountCents,
    _coins: contents.coins,
    _scout_reports: contents.scoutReports,
    _training_boosts: contents.trainingBoosts,
    _themes: contents.themes,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function syncSubscriptionForUser(
  subscription: Stripe.Subscription,
  userId: string,
  env: StripeEnv,
): Promise<void> {
  const item = subscription.items?.data?.[0];
  if (!item) throw new Error("Subscription has no price items");
  const priceId =
    item.price.lookup_key || item.price.metadata["lovable_external_id"] || item.price.id;
  const product = item.price.product;
  const productId = typeof product === "string" ? product : product.id;
  const periodStart = item.current_period_start;
  const periodEnd = item.current_period_end;

  const supabase = getStoreServiceSupabase();

  const { error: subscriptionError } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (subscriptionError) throw new Error(subscriptionError.message);

  const active =
    ["active", "trialing"].includes(subscription.status) &&
    periodEnd &&
    new Date(periodEnd * 1000) > new Date();
  const canceledButValid =
    subscription.status === "canceled" && periodEnd && new Date(periodEnd * 1000) > new Date();
  const seasonPassUntil =
    active || canceledButValid ? new Date(periodEnd * 1000).toISOString() : null;

  const { error: walletError } = await supabase.from("user_wallet").upsert(
    {
      user_id: userId,
      season_pass: !!seasonPassUntil,
      season_pass_until: seasonPassUntil,
    },
    { onConflict: "user_id" },
  );
  if (walletError) throw new Error(walletError.message);
}

/** Authenticated subscriptions retain the existing Stripe metadata contract. */
export async function syncSubscription(
  subscription: Stripe.Subscription,
  env: StripeEnv,
): Promise<void> {
  const userId = subscription.metadata["userId"];
  if (!userId) throw new Error("No userId in subscription metadata");
  await syncSubscriptionForUser(subscription, userId, env);
}
