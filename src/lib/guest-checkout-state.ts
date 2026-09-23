/**
 * Stripe can mark a Checkout Session complete before an asynchronous payment
 * method has settled. Keep that state distinct from an abandoned or expired
 * session so the visitor cannot accidentally open a second charge.
 */
export type GuestCheckoutSessionDisposition = "paid" | "open" | "settling" | "closed";

export function classifyGuestCheckoutSession(
  status: string | null | undefined,
  paymentStatus: string | null | undefined,
): GuestCheckoutSessionDisposition {
  if (paymentStatus === "paid" || paymentStatus === "no_payment_required") return "paid";
  if (status === "open") return "open";
  if (status === "complete") return "settling";
  return "closed";
}
