import { createFileRoute } from "@tanstack/react-router";
import { processStripeWebhook, rejectNonPostStripeWebhook } from "../public/payments/webhook";

/**
 * Stable public Stripe alias. Signatures are checked against the original
 * unmodified request body by the same handler as the canonical endpoint.
 */
export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => processStripeWebhook(request),
      GET: rejectNonPostStripeWebhook,
      HEAD: rejectNonPostStripeWebhook,
    },
  },
});
