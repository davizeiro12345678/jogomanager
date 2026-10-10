import type { StripeEnv } from "@/lib/stripe.server";
import type Stripe from "stripe";
import {
  getServerStoreProduct,
  getStoreServiceSupabase,
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

/** Authenticated checkouts freeze the same offer contract as guest intents.
 * Never infer historical paid benefits from today's mutable catalog. */
export async function getAuthenticatedCheckoutOffer(
  userId: string,
  sessionId: string,
  env: StripeEnv,
): Promise<{
  productKey: string;
  stripePriceId: string;
  currency: string;
  snapshot: FulfillmentSnapshot;
}> {
  const { data: offer, error } = await getStoreServiceSupabase()
    .from("checkout_session_owners")
    .select("product_key, price_cents, currency, stripe_price_id, contents_snapshot")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("environment", env)
    .maybeSingle();
  if (error)
    throw new Error("Não foi possível consultar a oferta da compra. O pagamento será repetido.");
  const contents = parseStoreProductContents(offer?.contents_snapshot);
  if (
    !offer?.product_key ||
    !offer.stripe_price_id ||
    !offer.currency ||
    !Number.isSafeInteger(offer.price_cents) ||
    (offer.price_cents ?? -1) < 0 ||
    !contents
  ) {
    throw new Error("Esta compra precisa de revisão da oferta registrada antes da entrega.");
  }
  return {
    productKey: offer.product_key,
    stripePriceId: offer.stripe_price_id,
    currency: offer.currency,
    snapshot: { priceCents: offer.price_cents!, contents },
  };
}

export async function isPurchaseDelivered(userId: string, reference: string): Promise<boolean> {
  const { data, error } = await getStoreServiceSupabase()
    .from("user_purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("reference", reference)
    .eq("status", "completed")
    .maybeSingle();
  if (error) throw new Error("Não foi possível consultar a entrega da compra.");
  return data !== null;
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
  if (error) throw new Error("Não foi possível registrar a compra pendente.");
}

/** Registers a payment failure while retaining a completed purchase as final. */
export async function markPurchaseFailed(reference: string, message: string): Promise<void> {
  const supabase = getStoreServiceSupabase();
  const { error } = await supabase
    .from("user_purchases")
    .update({ status: "failed", error: message.slice(0, 400) })
    .eq("reference", reference)
    .neq("status", "completed");
  if (error) throw new Error("Não foi possível registrar a falha do pagamento.");
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
  snapshot: FulfillmentSnapshot,
  paidAmountCents = amountCents,
): Promise<boolean> {
  const supabase = getStoreServiceSupabase();
  const priceCents = snapshot.priceCents;
  const contents = parseStoreProductContents(snapshot.contents);
  if (
    !Number.isSafeInteger(paidAmountCents) ||
    paidAmountCents < 0 ||
    paidAmountCents > 2_147_483_647
  )
    throw new Error("O total do pagamento é inválido.");
  if (
    !Number.isSafeInteger(priceCents) ||
    priceCents < 0 ||
    !Number.isSafeInteger(amountCents) ||
    amountCents !== priceCents
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
    _amount_cents: paidAmountCents,
    _coins: contents.coins,
    _scout_reports: contents.scoutReports,
    _training_boosts: contents.trainingBoosts,
    _themes: contents.themes,
  });
  if (error) throw new Error(error.message);
  if (data === true) {
    const { notifySlack } = await import("./slack.server");
    notifySlack(
      `Nova compra entregue: ${productKey} — R$ ${(paidAmountCents / 100).toFixed(2).replace(".", ",")}`,
    );
  }
  return data === true;
}

export type PaymentReviewEvent = {
  eventId: string;
  reference: string;
  type: "charge.refunded" | "payment_intent.payment_failed";
  created: number;
  refundedAmountCents?: number;
};

/** Durable event journal. Concurrent deliveries may both continue; the credit
 * RPC and review RPC remain atomic. A failed delivery is never acknowledged. */
export async function beginPaymentEvent(eventId: string, eventType: string): Promise<boolean> {
  const { data, error } = await getStoreServiceSupabase().rpc("begin_payment_webhook_event", {
    _event_id: eventId,
    _event_type: eventType,
  });
  if (error) throw new Error("Não foi possível registrar o evento do pagamento.");
  return data === true;
}

export async function finishPaymentEvent(eventId: string, succeeded: boolean): Promise<void> {
  const { error } = await getStoreServiceSupabase().rpc("finish_payment_webhook_event", {
    _event_id: eventId,
    _succeeded: succeeded,
  });
  if (error) throw new Error("Não foi possível concluir o registro do pagamento.");
}

/** Refunds are reviewed without changing delivered benefits. The separate
 * review record also survives a refund arriving before the purchase row. */
export async function reconcilePaymentReview(event: PaymentReviewEvent): Promise<void> {
  const { error } = await getStoreServiceSupabase().rpc("reconcile_purchase_payment_review", {
    _event_id: event.eventId,
    _reference: event.reference,
    _event_type: event.type,
    _event_created: event.created,
    _refunded_amount_cents: event.refundedAmountCents ?? 0,
  });
  if (error) throw new Error("Não foi possível reconciliar o pagamento. O evento será repetido.");
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

  // A customer can have overlapping subscriptions while Stripe delivers old
  // events out of order. Recompute the wallet from every subscription inside
  // one database function so an older cancellation cannot erase a newer pass.
  const { error: walletError } = await supabase.rpc("reconcile_subscription_wallet", {
    _user_id: userId,
    _environment: env,
  });
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
