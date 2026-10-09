import { createFileRoute } from "@tanstack/react-router";
import {
  type StripeEnv,
  createStripeClient,
  getConfiguredStripeEnvironment,
  verifyWebhook,
} from "@/lib/stripe.server";
import {
  fulfillOneTimePurchase,
  markPurchaseFailed,
  recordPendingPurchase,
  syncSubscription,
} from "@/lib/fulfillment.server";
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
  const price = lineItem?.price;
  const stripeProductKey =
    price?.lookup_key ||
    (price?.metadata?.["lovable_external_id"] as string | undefined) ||
    price?.id;
  const productKey =
    full.metadata?.["productKey"] ||
    (stripeProductKey === "season_pass_monthly" ? "season_pass" : stripeProductKey);
  // Validate against the list price before Stripe discounts (sales/promo codes);
  // Stripe already verified the customer paid the discounted total.
  const amount =
    lineItem?.amount_subtotal ?? full.amount_subtotal ?? lineItem?.amount_total ?? full.amount_total ?? 0;
  return { productKey, amount, session: full };
}

async function fulfillSession(sessionId: string, userId: string, env: StripeEnv) {
  const { productKey, amount } = await resolvePurchase(sessionId, env);
  if (!productKey) {
    await markPurchaseFailed(sessionId, "Item da compra não identificado");
    throw new Error(`No product key on session ${sessionId}`);
  }
  await recordPendingPurchase(userId, productKey, sessionId, amount);
  await fulfillOneTimePurchase(userId, productKey, sessionId, amount);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      if (isUnclaimedGuestSubscription(subscription)) {
        // The claim flow adds `userId` to the Stripe subscription before the
        // next reconciliation. Until then there is no wallet to update.
        break;
      }
      await syncSubscription(subscription, env);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      if (isUnclaimedGuestSubscription(subscription)) break;
      await syncSubscription({ ...subscription, status: "canceled" }, env);
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object;
      if (await handleGuestCheckoutSession(session, env)) {
        break;
      }
      const userId = session.metadata?.["userId"];
      if (!userId) {
        console.error("No userId in checkout session metadata");
        return;
      }
      if (session.mode !== "payment") {
        // Assinaturas são tratadas pelos eventos customer.subscription.*.
        break;
      }
      if (session.payment_status === "unpaid") {
        // Boleto/PIX com confirmação lenta: registra pendente e espera.
        const { productKey, amount } = await resolvePurchase(session.id, env);
        if (productKey) {
          await recordPendingPurchase(userId, productKey, session.id, amount);
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
        console.error("No userId in async payment session metadata");
        return;
      }
      if (session.mode === "payment") {
        await fulfillSession(session.id, userId, env);
      }
      break;
    }
    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      const intentId = guestCheckoutIntentId(session);
      if (intentId) {
        await markGuestCheckoutFailed(intentId, session.id, env);
        break;
      }
      await markPurchaseFailed(session.id, "Pagamento não foi concluído");
      break;
    }

    case "invoice.paid": {
      // Subscription renewals reconcile here; customer.subscription.updated
      // already keeps the row current. Use this for extra reconciliation if needed.
      break;
    }
    default:
      console.log("Unhandled webhook event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        try {
          const env = getConfiguredStripeEnvironment();
          // Lovable configures Stripe endpoints with ?env=sandbox or ?env=live.
          // Keep that URL contract, but bind it to the trusted deployment
          // setting before choosing a Stripe key or webhook secret.
          if (rawEnv !== env) {
            console.error("Webhook environment does not match this deployment:", rawEnv);
            return new Response("Webhook environment mismatch", { status: 400 });
          }
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
