import { createFileRoute } from "@tanstack/react-router";
import {
  type StripeEnv,
  createStripeClient,
  verifyWebhook,
} from "@/lib/stripe.server";
import {
  fulfillOneTimePurchase,
  markPurchaseFailed,
  recordPendingPurchase,
  syncSubscription,
} from "@/lib/fulfillment.server";

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
  const productKey =
    price?.lookup_key ||
    (price?.metadata?.["lovable_external_id"] as string | undefined) ||
    price?.id;
  const amount = lineItem?.amount_total ?? full.amount_total ?? 0;
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
      await syncSubscription(event.data.object, env);
      break;
    }
    case "customer.subscription.deleted": {
      await syncSubscription(
        { ...event.data.object, status: "canceled" },
        env
      );
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
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
      const userId = session.metadata?.userId;
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
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error(
            "Webhook received with invalid or missing env query parameter:",
            rawEnv
          );
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
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
