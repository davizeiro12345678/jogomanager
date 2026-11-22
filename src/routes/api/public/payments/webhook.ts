import { createFileRoute } from "@tanstack/react-router";
import {
  type StripeEnv,
  createStripeClient,
  getConfiguredStripeEnvironment,
  verifyWebhook,
} from "@/lib/stripe.server";
import {
  fulfillOneTimePurchase,
  beginPaymentEvent,
  finishPaymentEvent,
  reconcilePaymentReview,
  getAuthenticatedCheckoutOffer,
  isPurchaseDelivered,
  markPurchaseFailed,
  recordPendingPurchase,
  syncSubscription,
} from "@/lib/fulfillment.server";
import type Stripe from "stripe";
import { markGuestCheckoutFailed, markGuestCheckoutPaid } from "@/lib/guest-checkout.functions";
import { deliverClaimedGuestPurchase } from "@/lib/guest-checkout-delivery.server";

type StripeSessionEvent = {
  id: string;
  payment_status?: string | null;
  metadata?: Record<string, string> | null;
};

type StripeSubscriptionEvent = {
  metadata?: Record<string, string> | null;
};

function guestCheckoutIntentId(session: StripeSessionEvent): string | null {
  const intentId = session.metadata?.["guestCheckoutIntentId"];
  return typeof intentId === "string" && intentId.length > 0 ? intentId : null;
}

/**
 * Guest sessions have no `userId` until the matching email authenticates on
 * the claim page. They must therefore be consumed before the account-based
 * webhook path, while delayed payments remain pending until Stripe marks them
 * paid in a later event.
 */
async function handleGuestCheckoutSession(
  session: StripeSessionEvent,
  env: StripeEnv,
): Promise<boolean> {
  const intentId = guestCheckoutIntentId(session);
  if (!intentId) return false;
  if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
    await markGuestCheckoutPaid(intentId, session.id, env);
    // Se a compra já foi vinculada a uma conta, entrega aqui pelo fluxo
    // verificado do webhook; sem vínculo, a entrega aguarda o claim.
    await deliverClaimedGuestPurchase(intentId, session.id, env);
  }
  return true;
}

/** A guest subscription is linked to a user only after the email claim. */
function isUnclaimedGuestSubscription(subscription: StripeSubscriptionEvent): boolean {
  return (
    Boolean(subscription.metadata?.["guestCheckoutIntentId"]) && !subscription.metadata?.["userId"]
  );
}

/**
 * A Stripe NÃO envia os itens comprados no corpo do evento: é preciso buscar a
 * sessão com `line_items` expandido. Sem isso o jogo não descobre qual pacote
 * foi pago e a entrega falha em silêncio.
 */
async function resolvePurchase(sessionId: string, env: StripeEnv) {
  const stripe = createStripeClient(env);
  const full = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price"],
  });
  const lineItem = full.line_items?.data?.[0];
  if (
    full.mode !== "payment" ||
    full.currency !== "brl" ||
    full.line_items?.data.length !== 1 ||
    full.line_items.has_more ||
    lineItem?.quantity !== 1
  ) {
    throw new Error("Unexpected checkout commercial offer");
  }
  const price = lineItem?.price;
  const userId = full.metadata?.["userId"];
  if (!userId) throw new Error("Checkout has no account owner");
  const offer = await getAuthenticatedCheckoutOffer(userId, sessionId, env);
  if (
    price?.id !== offer.stripePriceId ||
    full.currency?.toUpperCase() !== offer.currency.toUpperCase() ||
    lineItem.amount_subtotal !== offer.snapshot.priceCents
  )
    throw new Error("Checkout does not match its registered offer");
  const productKey = offer.productKey;
  // Validate against the list price before Stripe discounts (sales/promo codes);
  // Stripe already verified the customer paid the discounted total.
  const amount =
    lineItem?.amount_subtotal ??
    full.amount_subtotal ??
    lineItem?.amount_total ??
    full.amount_total ??
    0;
  const paidAmount = full.amount_total;
  if (paidAmount === null || !Number.isSafeInteger(paidAmount) || paidAmount < 0) {
    throw new Error("Checkout has no valid settled amount");
  }
  return { productKey, amount, paidAmount, snapshot: offer.snapshot, session: full };
}

async function fulfillSession(sessionId: string, userId: string, env: StripeEnv) {
  // Already delivered legacy sessions need no catalog reconstruction.
  if (await isPurchaseDelivered(userId, sessionId)) return;
  const { productKey, amount, paidAmount, session, snapshot } = await resolvePurchase(
    sessionId,
    env,
  );
  if (
    session.metadata?.["userId"] !== userId ||
    !["paid", "no_payment_required"].includes(session.payment_status)
  )
    throw new Error("Checkout payment is not settled for this account");
  if (!productKey) {
    await markPurchaseFailed(sessionId, "Item da compra não identificado");
    throw new Error(`No product key on session ${sessionId}`);
  }
  await recordPendingPurchase(userId, productKey, sessionId, paidAmount);
  await fulfillOneTimePurchase(userId, productKey, sessionId, amount, snapshot, paidAmount);
}

async function handleWebhook(event: Stripe.Event, env: StripeEnv) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = await createStripeClient(env).subscriptions.retrieve(
        event.data.object.id,
      );
      if (isUnclaimedGuestSubscription(subscription)) {
        // The claim flow adds `userId` to the Stripe subscription before the
        // next reconciliation. Until then there is no wallet to update.
        break;
      }
      await syncSubscription(subscription, env);
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object;
      if (await handleGuestCheckoutSession(session, env)) {
        break;
      }
      const userId = session.metadata?.["userId"];
      if (!userId) {
        throw new Error("No userId in checkout session metadata");
      }
      if (session.mode !== "payment") {
        // Assinaturas são tratadas pelos eventos customer.subscription.*.
        break;
      }
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
        // Boleto/PIX com confirmação lenta: registra pendente e espera.
        const { productKey, paidAmount } = await resolvePurchase(session.id, env);
        if (productKey) {
          await recordPendingPurchase(userId, productKey, session.id, paidAmount);
        }
        return;
      }
      await fulfillSession(session.id, userId, env);
      break;
    }
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (await handleGuestCheckoutSession(session, env)) {
        break;
      }
      const userId = session.metadata?.["userId"];
      if (!userId) {
        throw new Error("No userId in async payment session metadata");
      }
      if (session.mode === "payment") {
        await fulfillSession(session.id, userId, env);
      }
      break;
    }

    case "charge.refunded":
    case "payment_intent.payment_failed": {
      const object = event.data.object;
      const charge = event.type === "charge.refunded" ? (object as Stripe.Charge) : null;
      const paymentIntent = charge
        ? typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id
        : object.id;
      if (!paymentIntent) throw new Error("Payment review has no payment intent");
      const sessions = await createStripeClient(env).checkout.sessions.list({
        payment_intent: paymentIntent,
        limit: 100,
      });
      // A checkout-bound intent must resolve from Stripe, never event metadata.
      // No sessions means a payment created outside this application's checkout.
      for (const session of sessions.data) {
        const intentId = guestCheckoutIntentId(session);
        if (event.type === "payment_intent.payment_failed" && intentId) {
          await markGuestCheckoutFailed(intentId, session.id, env);
        }
        await reconcilePaymentReview({
          eventId: event.id,
 