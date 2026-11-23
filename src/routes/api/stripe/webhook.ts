import { createFileRoute } from "@tanstack/react-router";
import { handleStripeWebhookPost, rejectNonPostStripeWebhook } from "../public/payments/webhook";

/**
 * Public compatibility endpoint. GET is a non-sensitive liveness/contract
 * response only; Stripe deliveries must use POST with a verified signature.
 * Keep the original signed handler as the single source of fulfillment logic.
 */
export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { service: "stripe-webhook", method: "POST", signatureRequired: true },
          {
            headers: {
              "cache-control": "no-store",
              "x-content-type-options": "nosniff",
            },
          },
        ),
      HEAD: rejectNonPostStripeWebhook,
      POST: handleStripeWebhookPost,
    },
  },
});
