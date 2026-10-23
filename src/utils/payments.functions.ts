import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createStripeClient,
  createStripeIntegrationIdentifier,
  getConfiguredStripeEnvironment,
  getStripeErrorMessage,
} from "@/lib/stripe.server";
import {
  assertStoreProductKey,
  getServerStoreProduct,
  getStoreServiceSupabase,
  resolveValidatedStripePrice,
  checkoutDiscountParams,
} from "@/lib/store-products.server";
import { assertPaymentsConfigured } from "@/lib/payments-config.server";
import { PublicPaymentError } from "@/lib/payment-errors";
import { assessAccountCheckoutFraudDefense } from "@/lib/google-fraud-defense.server";
import type { StripeEnv } from "@/lib/stripe.server";
import { getTrustedCheckoutOrigin, validateCheckoutReturnUrl } from "@/lib/checkout-origin.server";
import type { Json } from "@/integrations/supabase/types";

export type CheckoutSessionResult = { clientSecret: string } | { error: string };

export type PortalSessionResult = { url: string } | { error: string };

export async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0]!.id;
  }
  // An email match is not proof of customer ownership. Reusing a Stripe
  // customer by address could attach a different account's saved payment data.
  const created = await stripe.customers.create({
    ...(options.email ? { email: options.email } : {}),
    ...(options.userId ? { metadata: { userId: options.userId } } : {}),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      productKey: string;
      quantity?: number;
      returnUrl: string;
      clientEnvironment: StripeEnv;
      fraudDefenseToken?: string | null;
    }) => {
      assertStoreProductKey(data.productKey);
      if (data.quantity != null && data.quantity !== 1) throw new Error("Invalid quantity");
      if (typeof data.returnUrl !== "string") throw new Error("Invalid returnUrl");
      if (data.clientEnvironment !== "live" && data.clientEnvironment !== "sandbox") {
        throw new Error("Ambiente de pagamento inválido.");
      }
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const environment = assertPaymentsConfigured();
      if (data.clientEnvironment !== environment) throw new PublicPaymentError("unavailable");
      const request = getRequest();
      if (!request) throw new PublicPaymentError("invalid_return");
      const returnUrl = validateCheckoutReturnUrl(request, data.returnUrl, "/checkout/return");

      // `store_products` selects the current active SKU first; Stripe only
      // confirms that its server-side amount and currency still match it.
      const product = await getServerStoreProduct(getStoreServiceSupabase(), data.productKey);
      await assessAccountCheckoutFraudDefense(data.fraudDefenseToken, request);
      const stripe = createStripeClient(environment);
      const stripePrice = await resolveValidatedStripePrice(stripe, product);
      const isRecurring = stripePrice.type === "recurring";

      const email = typeof context.claims?.email === "string" ? context.claims.email : undefined;

      const customerId = await resolveOrCreateCustomer(stripe, {
        ...(email ? { email } : {}),
        userId: context.userId,
      });

      let productDescription: string | undefined;
      if (!isRecurring) {
        const productId =
          typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
        const product = await stripe.products.retrieve(productId);
        productDescription = product.name;
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        integration_identifier: createStripeIntegrationIdentifier(),
        return_url: returnUrl,
        customer: customerId,
        ...(await checkoutDiscountParams(stripe, product)),
        ...(!isRecurring && {
          payment_intent_data: { description: productDescription },
        }),
        metadata: { userId: context.userId, productKey: product.key },
        ...(isRecurring && {
          subscription_data: { metadata: { userId: context.userId } },
        }),
      } as Parameters<ReturnType<typeof createStripeClient>["checkout"]["sessions"]["create"]>[0]);

      if (!session.id || !session.client_secret) throw new Error("Checkout session is incomplete");
      const { error: offerError } = await getStoreServiceSupabase()
        .from("checkout_session_owners")
        .insert({
          session_id: session.id,
          user_id: context.userId,
          environment,
          product_key: product.key,
          // Stripe's immutable unit price is checked before discounts; store
          // the settled total separately when granting the purchase.
          price_cents: product.priceCents,
          currency: product.currency,
          stripe_price_id: stripePrice.id,
          contents_snapshot: product.contents as unknown as Json,
        });
      if (offerError) throw new Error("Checkout offer could not be persisted");
      return { clientSecret: session.client_secret };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { returnUrl?: string }) => {
    if (data.returnUrl !== undefined && typeof data.returnUrl !== "string") {
      throw new Error("Invalid returnUrl");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    try {
      const environment = getConfiguredStripeEnvironment();
      const request = getRequest();
      if (!request) throw new PublicPaymentError("invalid_return");
      getTrustedCheckoutOrigin(request);
      let approvedReturnUrl: string | undefined;
      if (data.returnUrl) {
        approvedReturnUrl = validateCheckoutReturnUrl(request, data.returnUrl);
      }
      const { data: sub, error: subError } = await context.supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", context.userId)
        .eq("environment", environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (subError || !sub?.stripe_customer_id) {
        if (subError) throw new Error("Subscription lookup failed");
        throw new PublicPaymentError("no_subscription");
      }

      const stripe = createStripeClient(environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        ...(approvedReturnUrl ? { return_url: approvedReturnUrl } : {}),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
