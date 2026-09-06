import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import {
  fulfillOneTimePurchase,
  syncSubscription,
} from "@/lib/fulfillment.server";

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
      if (session.payment_status === "unpaid") {
        // Delayed-notification payment methods: wait for async_payment_succeeded.
        return;
      }

      const userId = session.metadata?.userId;
      if (!userId) {
        console.error("No userId in checkout session metadata");
        return;
      }

      const mode = session.mode;
      if (mode === "payment") {
        const lineItem = session.line_items?.data?.[0];
        const price = lineItem?.price;
        const productKey =
          price?.lookup_key ||
          price?.metadata?.lovable_external_id ||
          price?.id;
        const amount = lineItem?.amount_total ?? session.amount_total ?? 0;
        await fulfillOneTimePurchase(
          userId,
          productKey,
          session.id,
          amount
        );
      } else if (mode === "subscription") {
        // Subscription state is handled by the customer.subscription.* events above.
        // We still mirror it here in case the subscription event is delayed.
        if (session.subscription) {
          // Subscription object is not expanded in this event; rely on customer.subscription.* events.
        }
      }
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
        const lineItem = session.line_items?.data?.[0];
        const price = lineItem?.price;
        const productKey =
          price?.lookup_key ||
          price?.metadata?.lovable_external_id ||
          price?.id;
        const amount = lineItem?.amount_total ?? session.amount_total ?? 0;
        await fulfillOneTimePurchase(
          userId,
          productKey,
          session.id,
          amount
        );
      }
      break;
    }
    case "checkout.session.async_payment_failed": {
      // Mark pending order as failed if you track pending orders.
      // For now we just log; the user can retry from the store.
      console.log("Async payment failed:", event.data.object.id);
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
