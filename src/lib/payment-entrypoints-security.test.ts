import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  request: vi.fn(),
  product: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  createSession: vi.fn(),
  retrieveSession: vi.fn(),
  portal: vi.fn(),
  price: vi.fn(),
  persistOffer: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      validator: () => builder,
      handler: (fn: unknown) => fn,
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: deps.request }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/stripe.server", async (importOriginal) => ({
  getConfiguredStripeEnvironment: () => "sandbox",
  createStripeIntegrationIdentifier: () => "fixture",
  getStripeErrorMessage: (await importOriginal<typeof import("./stripe.server")>())
    .getStripeErrorMessage,
  createStripeClient: () => ({
    checkout: { sessions: { create: deps.createSession, retrieve: deps.retrieveSession } },
    billingPortal: { sessions: { create: deps.portal } },
    customers: {
      search: async () => ({ data: [{ id: "cus_fixture" }] }),
      create: async () => ({ id: "cus_fixture" }),
    },
    products: { retrieve: async () => ({ name: "Coins" }) },
  }),
}));
vi.mock("@/lib/payments-config.server", () => ({
  assertPaymentsConfigured: () => "sandbox",
  assertGuestCheckoutEnabled: () => "sandbox",
  PAYMENTS_UNAVAILABLE: "unavailable",
}));
vi.mock("@/lib/fulfillment.server", () => ({
  fulfillOneTimePurchase: vi.fn(),
  recordPendingPurchase: vi.fn(),
  syncSubscriptionForUser: vi.fn(),
}));
vi.mock("@/lib/store-products.server", () => ({
  assertStoreProductKey: vi.fn(),
  getServerStoreProduct: deps.product,
  getStoreServiceSupabase: () => ({ from: deps.from, rpc: deps.rpc }),
  resolveValidatedStripePrice: deps.price,
  checkoutDiscountParams: async () => ({}),
  parseStoreProductContents: (v: unknown) => v,
}));
import { createCheckoutSession, createPortalSession } from "@/utils/payments.functions";
import { startGuestCheckout } from "./guest-checkout.functions";
type Handler = (args: {
  data: Record<string, unknown>;
  context?: Record<string, unknown>;
}) => Promise<Record<string, unknown>>;
const checkout = createCheckoutSession as unknown as Handler;
const portal = createPortalSession as unknown as Handler;
const guest = startGuestCheckout as unknown as Handler;
const context = { userId: "user_fixture", claims: {}, supabase: { from: deps.from } };
const guestData = {
  email: "visitor@example.com",
  productKey: "coins_small",
  hasPurchaseConsent: true,
  clientEnvironment: "sandbox",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SITE_URL", "https://jogomanager.com");
  vi.stubEnv("GOOGLE_FRAUD_DEFENSE_MODE", "off");
  vi.stubEnv("GUEST_CHECKOUT_EMAIL_HASH_SECRET", "fixture-not-a-secret");
  deps.request.mockReturnValue(
    new Request("https://jogomanager.com/_server", {
      headers: { origin: "https://jogomanager.com" },
    }),
  );
  deps.product.mockResolvedValue({
    key: "coins_small",
    priceCents: 500,
    checkoutPriceCents: 500,
    currency: "BRL",
    contents: { coins: 100, scoutReports: 0, trainingBoosts: 0, themes: [] },
  });
  deps.price.mockResolvedValue({ id: "price_fixture", product: "prod_fixture", type: "one_time" });
  deps.createSession.mockResolvedValue({ id: "cs_fixture", client_secret: "cs_fixture" });
  deps.persistOffer.mockResolvedValue({ error: null });
  deps.from.mockReturnValue({ insert: deps.persistOffer });
});
afterEach(() => vi.unstubAllEnvs());

describe("real payment handler boundaries with mocked providers", () => {
  it("enforcement rejects account checkout before creating a Stripe session", async () => {
    vi.stubEnv("GOOGLE_FRAUD_DEFENSE_MODE", "enforce");
    vi.stubEnv("GOOGLE_RECAPTCHA_API_KEY", "");
    const result = await checkout({
      data: {
        productKey: "coins_small",
        clientEnvironment: "sandbox",
        returnUrl: "https://jogomanager.com/checkout/return?session_id={CHECKOUT_SESSION_ID}",
      },
      context,
    });
    expect(result).toHaveProperty("error");
    expect(deps.createSession).not.toHaveBeenCalled();
    expect(deps.price).not.toHaveBeenCalled();
  });
  it.each([
    "https://evil.example/checkout/return",
    "https://evil.example@jogomanager.com/checkout/return",
  ])("blocks checkout and portal before a Stripe call for %s", async (returnUrl) => {
    expect(
      await checkout({
        data: { productKey: "coins_small", clientEnvironment: "sandbox", returnUrl },
        context,
      }),
    ).toHaveProperty("error");
    expect(await portal({ data: { returnUrl }, context })).toHaveProperty("error");
    expect(deps.createSession).not.toHaveBeenCalled();
    expect(deps.portal).not.toHaveBeenCalled();
    expect(deps.product).not.toHaveBeenCalled();
    expect(deps.from).not.toHaveBeenCalled();
  });
  it("passes only the canonical approved return to Stripe", async () => {
    expect(
      await checkout({
        data: {
          productKey: "coins_small",
          clientEnvironment: "sandbox",
          returnUrl: "https://JOGOMANAGER.com:443/checkout/return?session_id={CHECKOUT_SESSION_ID}",
        },
        context,
      }),
    ).toEqual({ clientSecret: "cs_fixture" });
    expect(deps.createSession.mock.calls[0]?.[0].return_url).toBe(
      "https://jogomanager.com/checkout/return?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(deps.persistOffer).toHaveBeenCalledWith({
      session_id: "cs_fixture",
      user_id: "user_fixture",
      environment: "sandbox",
      product_key: "coins_small",
      price_cents: 500,
      currency: "BRL",
      stripe_price_id: "price_fixture",
      contents_snapshot: { coins: 100, scoutReports: 0, trainingBoosts: 0, themes: [] },
    });
  });
  it("freezes the original price for a promoted guest checkout before returning its secret", async () => {
    deps.product.mockResolvedValue({
      key: "coins_small",
      priceCents: 500,
      checkoutPriceCents: 400,
      salePercentOff: 20,
      currency: "BRL",
      contents: { coins: 100, scoutReports: 0, trainingBoosts: 0, themes: [] },
    });
    deps.rpc.mockResolvedValue({ data: true, error: null });
    const insert = vi.fn();
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      update: () => chain,
      insert,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: { id: "intent_fixture", environment: "sandbox" }, error: null }),
    };
    insert.mockReturnValue(chain);
    deps.from.mockReturnValue(chain);
    expect(await guest({ data: guestData })).toEqual({
      clientSecret: "cs_fixture",
      intentId: "intent_fixture",
      environment: "sandbox",
    });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ amount_cents: 500 }));
  });
  it("withholds the client secret when the immutable checkout offer cannot be saved", async () => {
    deps.persistOffer.mockResolvedValue({ error: { message: "database offline" } });
    const result = await checkout({
      data: {
        productKey: "coins_small",
        clientEnvironment: "sandbox",
        returnUrl: "https://jogomanager.com/checkout/return",
      },
      context,
    });
    expect(result).toHaveProperty("error");
    expect(result).not.toHaveProperty("clientSecret");
    expect(deps.createSession).toHaveBeenCalledOnce();
    expect(deps.persistOffer).toHaveBeenCalledOnce();
  });
  it("keeps the account billing portal and approved same-origin return usable", async () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: { stripe_customer_id: "cus_fixture" }, error: null }),
    };
    deps.from.mockReturnValue(chain);
    deps.portal.mockResolvedValue({ url: "https://billing.stripe.com/p/session_fixture" });
    expect(
      await portal({ data: { returnUrl: "https://jogomanager.com/produtos" }, context }),
    ).toEqual({ url: "https://billing.stripe.com/p/session_fixture" });
    expect(deps.portal).toHaveBeenCalledWith({
      customer: "cus_fixture",
      return_url: "https://jogomanager.com/produtos",
    });
  });
  it("rejects cross-site email-offer creation before any database work", async () => {
    deps.request.mockReturnValue(
      new Request("https://jogomanager.com/_server", {
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(await guest({ data: guestData })).toHaveProperty("error");
    expect(deps.product).not.toHaveBeenCalled();
    expect(deps.rpc).not.toHaveBeenCalled();
    expect(deps.from).not.toHaveBeenCalled();
  });
  it("sanitizes an actual guest database/schema error at the public handler boundary", async () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({
        data: null,
        error: {
          message: "SQL private.guest_checkout_intents exposes visitor@example.com",
          code: "42P01",
        },
      }),
    };
    deps.from.mockReturnValue(chain);
    expect(await guest({ data: guestData })).toEqual({
      error: "Os pagamentos estão temporariamente indisponíveis. Tente novamente mais tarde.",
    });
    expect(deps.createSession).not.toHaveBeenCalled();
  });
  it("sanitizes Stripe internals while keeping an actionable card decline", async () => {
    deps.createSession.mockRejectedValue({
      type: "StripeCardError",
      decline_code: "insufficient_funds",
      message: "customer visitor@example.com cus_private failed",
      raw: { message: "secret SQL/provider detail", param: "customer", requestId: "req_private" },
    });
    expect(
      await checkout({
        data: {
          productKey: "coins_small",
          clientEnvironment: "sandbox",
          returnUrl: "https://jogomanager.com/checkout/return",
        },
        context,
      }),
    ).toEqual({ error: "O cartão não tem saldo suficiente. Use outra forma de pagamento." });
  });
  it("keeps the authenticated legacy email-offer provider contract usable when its service budget permits creation", async () => {
    const intent = {
      id: "11111111-1111-4111-8111-111111111111",
      environment: "sandbox",
      stripe_session_id: null,
    };
    const chain = {
      select: () => chain,
      eq: () => chain,
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: intent, error: null }),
      in: async () => ({ error: null }),
    };
    deps.from.mockReturnValue(chain);
    deps.rpc.mockResolvedValue({ data: true, error: null });
    expect(await guest({ data: guestData })).toEqual({
      clientSecret: "cs_fixture",
      intentId: intent.id,
      environment: "sandbox",
    });
    expect(chain.insert).toHaveBeenCalledOnce();
    expect(deps.createSession).toHaveBeenCalledOnce();
  });
  it("resumes an existing email-offer intent without spending the creation budget", async () => {
    const product = await deps.product();
    const intent = {
      id: "11111111-1111-4111-8111-111111111111",
      environment: "sandbox",
      state: "checkout_open",
      amount_cents: 500,
      currency: "BRL",
      contents_snapshot: product.contents,
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      stripe_session_id: "cs_existing",
    };
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: intent, error: null }),
    };
    deps.from.mockReturnValue(chain);
    deps.retrieveSession.mockResolvedValue({
      status: "open",
      payment_status: "unpaid",
      client_secret: "existing_secret",
    });
    expect(await guest({ data: guestData })).toEqual({
      clientSecret: "existing_secret",
      intentId: intent.id,
      environment: "sandbox",
    });
    expect(deps.rpc).not.toHaveBeenCalled();
    expect(deps.createSession).not.toHaveBeenCalled();
  });
  it.each([
    { data: false, error: null },
    { data: null, error: { message: "private table detail" } },
  ])(
    "fails closed before an intent or Stripe session when the service budget denies/fails",
    async (reservation) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
        insert: vi.fn(),
      };
      deps.from.mockReturnValue(chain);
      deps.rpc.mockResolvedValue(reservation);
      const result = await guest({ data: guestData });
      expect(result).toHaveProperty("error");
      expect(JSON.stringify(result)).not.toContain("private table detail");
      expect(deps.rpc).toHaveBeenCalledWith("reserve_guest_checkout_attempt", {
        _email_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      expect(chain.insert).not.toHaveBeenCalled();
      expect(deps.createSession).not.toHaveBeenCalled();
    },
  );
});
