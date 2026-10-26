import type Stripe from "stripe";
import type { StripeEnv } from "./stripe.server";
import { parseStoreProductContents } from "./store-products.server";

/** Both delivery paths verify the original price, then account for Stripe discounts. */
export function validateGuestCheckoutOffer(
  session: Stripe.Checkout.Session,
  intent: {
    id: string;
    product_key: string;
    stripe_session_id: string | null;
    stripe_price_id: string | null;
    amount_cents: number;
    currency: string;
    contents_snapshot: unknown;
  },
  environment: StripeEnv,
) {
  const item = session.line_items?.data[0];
  const amount = item?.amount_subtotal;
  const paidAmount = session.amount_total;
  const contents = parseStoreProductContents(intent.contents_snapshot);
  if (
    session.id !== intent.stripe_session_id ||
    session.livemode !== (environment === "live") ||
    session.metadata?.["guestCheckoutIntentId"] !== intent.id ||
    session.metadata?.["productKey"] !== intent.product_key ||
    (session.mode !== "payment" && session.mode !== "subscription") ||
    session.line_items?.has_more ||
    session.line_items?.data.length !== 1 ||
    item?.quantity !== 1 ||
    !intent.stripe_price_id ||
    item?.price?.id !== intent.stripe_price_id ||
    session.currency?.toUpperCase() !== intent.currency.toUpperCase() ||
    item?.price?.currency.toUpperCase() !== intent.currency.toUpperCase() ||
    !Number.isSafeInteger(intent.amount_cents) ||
    intent.amount_cents < 0 ||
    amount !== intent.amount_cents ||
    !Number.isSafeInteger(paidAmount) ||
    paidAmount === null ||
    paidAmount < 0 ||
    paidAmount > intent.amount_cents ||
    !contents
  ) {
    throw new Error("O valor do pagamento não confere com a compra registrada.");
  }
  return { amount: intent.amount_cents, paidAmount, contents };
}
