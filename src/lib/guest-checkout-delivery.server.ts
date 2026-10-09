import {
  fulfillOneTimePurchase,
  recordPendingPurchase,
  syncSubscriptionForUser,
} from "@/lib/fulfillment.server";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { getStoreServiceSupabase, parseStoreProductContents } from "@/lib/store-products.server";

interface ClaimedIntentRow {
  id: string;
  product_key: string;
  environment: string;
  state: string;
  amount_cents: number;
  currency: string;
  contents_snapshot: unknown;
  stripe_price_id: string | null;
  stripe_session_id: string | null;
  claimed_by_user_id: string | null;
}

/**
 * Entrega de compra visitante seguindo o fluxo verificado de evento de
 * pagamento: só executa para intenções já vinculadas a uma conta (claimed) e
 * reconfirma a sessão diretamente na Stripe antes de creditar qualquer item.
 * Chamada pelo webhook assinado e, após o vínculo da conta, pelo fluxo de
 * retorno — nunca credita nada sem a confirmação de pagamento da Stripe.
 */
export async function deliverClaimedGuestPurchase(
  intentId: string,
  sessionId: string,
  environment: StripeEnv,
): Promise<void> {
  const db = getStoreServiceSupabase();
  const { data, error } = await db
    .from("guest_checkout_intents")
    .select(
      "id, product_key, environment, state, amount_cents, currency, contents_snapshot, stripe_price_id, stripe_session_id, claimed_by_user_id",
    )
    .eq("id", intentId)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível consultar a compra: ${error.message}`);
  const intent = (data as ClaimedIntentRow | null) ?? null;
  if (!intent || intent.environment !== environment || intent.stripe_session_id !== sessionId) {
    throw new Error("A sessão não corresponde à compra visitante.");
  }
  // Sem conta vinculada ainda não há carteira para creditar; o webhook tenta
  // de novo quando o vínculo acontecer.
  if (intent.state !== "claimed" || !intent.claimed_by_user_id) return;
  const userId = intent.claimed_by_user_id;

  const stripe = createStripeClient(environment);
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price", "subscription"],
  });
  if (
    session.metadata?.["guestCheckoutIntentId"] !== intent.id ||
    session.metadata?.["productKey"] !== intent.product_key
  ) {
    throw new Error("A sessão não corresponde à compra visitante.");
  }
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return;
  }

  const lineItem = session.line_items?.data?.[0];
  // Preço de tabela antes dos descontos da Stripe; promoções baixam só o total.
  const amount = lineItem?.amount_subtotal ?? session.amount_subtotal ?? 0;
  const paymentCurrency = lineItem?.price?.currency ?? session.currency;
  const snapshotContents = parseStoreProductContents(intent.contents_snapshot);
  if (
    !intent.stripe_price_id ||
    !snapshotContents ||
    lineItem?.price?.id !== intent.stripe_price_id ||
    amount !== intent.amount_cents ||
    paymentCurrency?.toUpperCase() !== intent.currency
  ) {
    throw new Error("O valor do pagamento não confere com a compra registrada.");
  }

  if (session.mode === "payment") {
    await recordPendingPurchase(userId, intent.product_key, session.id, amount);
    await fulfillOneTimePurchase(userId, intent.product_key, session.id, amount, {
      priceCents: intent.amount_cents,
      contents: snapshotContents,
    });
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!subscriptionId) return;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await stripe.subscriptions.update(subscription.id, {
    metadata: {
      ...subscription.metadata,
      userId,
      guestCheckoutIntentId: intent.id,
    },
  });
  await syncSubscriptionForUser(subscription, userId, environment);
}
