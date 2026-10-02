import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createStripeClient,
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
import { assertPaymentsConfigured, PAYMENTS_UNAVAILABLE } from "@/lib/payments-config.server";
import type { StripeEnv } from "@/lib/stripe.server";

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
  .inputValidator(
    (data: {
      productKey: string;
      quantity?: number;
      returnUrl: string;
      clientEnvironment: StripeEnv;
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
      if (data.clientEnvironment !== environment) throw new Error(PAYMENTS_UNAVAILABLE);
      const request = getRequest();
      const requestOrigin = request ? new URL(request.url).origin : null;
      const returnUrl = new URL(data.returnUrl);
      if (
        !requestOrigin ||
        returnUrl.origin !== requestOrigin ||
        returnUrl.pathname !== "/checkout/return"
      ) {
        throw new Error("Invalid returnUrl");
      }

      // `store_products` selects the current active SKU first; Stripe only
      // confirms that its server-side amount and currency still match it.
      const product = await getServerStoreProduct(getStoreServiceSupabase(), data.productKey);
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
        return_url: data.returnUrl,
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

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string }) => {
    if (data.returnUrl !== undefined && typeof data.returnUrl !== "string") {
      throw new Error("Invalid returnUrl");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    try {
      const environment = getConfiguredStripeEnvironment();
      let approvedReturnUrl: string | undefined;
      if (data.returnUrl) {
        const request = getRequest();
        const requestOrigin = request ? new URL(request.url).origin : null;
        const returnUrl = new URL(data.returnUrl);
        if (!requestOrigin || returnUrl.origin !== requestOrigin) {
          throw new Error("Invalid returnUrl");
        }
        approvedReturnUrl = returnUrl.toString();
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
        throw new Error("No subscription found");
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
