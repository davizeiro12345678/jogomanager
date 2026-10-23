import { beforeEach, describe, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({
  session: vi.fn(),
  query: vi.fn(),
  rpc: vi.fn(),
  pending: vi.fn(),
  fulfill: vi.fn(),
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
vi.mock("@tanstack/react-start/server", () => ({ getRequest: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./verified-identity.server", () => ({
  verifiedAccount: async () => ({ email: "guest@example.com" }),
}));
vi.mock("./stripe.server", () => ({
  createStripeClient: () => ({ checkout: { sessions: { retrieve: deps.session } } }),
  getConfiguredStripeEnvironment: () => "sandbox",
}));
vi.mock("./fulfillment.server", () => ({
  fulfillOneTimePurchase: deps.fulfill,
  recordPendingPurchase: deps.pending,
  syncSubscriptionForUser: vi.fn(),
}));
vi.mock("./store-products.server", async (original) => ({
  ...(await original<typeof import("./store-products.server")>()),
  getStoreServiceSupabase: () => {
    const chain: Record<string, unknown> = {};
    for (const key of ["select", "eq", "update"]) chain[key] = vi.fn(() => chain);
    chain["maybeSingle"] = deps.query;
    return { from: () => chain, rpc: deps.rpc };
  },
}));
import { deliverClaimedGuestPurchase } from "./guest-checkout-delivery.server";
import { claimGuestCheckout } from "./guest-checkout.functions";
import { validateGuestCheckoutOffer } from "./guest-checkout-offer.server";
const contents = { coins: 1500, scoutReports: 2, trainingBoosts: 0, themes: [] };
const baseIntent = {
  id: "intent_fixture",
  product_key: "coins_small",
  environment: "sandbox",
  state: "claimed",
  amount_cents: 500,
  currency: "BRL",
  contents_snapshot: contents,
  stripe_price_id: "price_fixture",
  stripe_session_id: "cs_fixture",
  claimed_by_user_id: "user_fixture",
};
const baseSession = {
  id: "cs_fixture",
  livemode: false,
  mode: "payment",
  payment_status: "paid",
  currency: "brl",
  metadata: { guestCheckoutIntentId: "intent_fixture", productKey: "coins_small" },
  customer_details: { email: "guest@example.com" },
  amount_subtotal: 500,
  amount_total: 400,
  line_items: {
    has_more: false,
    data: [
      {
        quantity: 1,
        amount_subtotal: 500,
        amount_total: 400,
        price: { id: "price_fixture", currency: "brl" },
      },
    ],
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("GUEST_CHECKOUT_EMAIL_HASH_SECRET", "fixture");
  deps.query.mockResolvedValue({ data: baseIntent, error: null });
  deps.session.mockResolvedValue(baseSession);
  deps.rpc.mockResolvedValue({ data: true, error: null });
});
describe("guest discounted offer contract", () => {
  it("delivers the frozen benefits and records the actual discounted total through the webhook path", async () => {
    await deliverClaimedGuestPurchase(baseIntent.id, "cs_fixture", "sandbox");
    expect(deps.pending).toHaveBeenCalledWith("user_fixture", "coins_small", "cs_fixture", 400);
    expect(deps.fulfill).toHaveBeenCalledWith(
      "user_fixture",
      "coins_small",
      "cs_fixture",
      500,
      { priceCents: 500, contents },
      400,
    );
  });
  it("claims a promoted purchase with the same subtotal and paid-total contract", async () => {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode("fixture\0guest@example.com"),
    );
    const email_hash = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    // The real claim update is visible to the shared webhook delivery read.
    deps.query
      .mockResolvedValueOnce({
        data: { ...baseIntent, state: "paid", email_hash },
        error: null,
      })
      .mockResolvedValue({ data: { ...baseIntent, state: "claimed", email_hash }, error: null });
    const claim = claimGuestCheckout as unknown as (args: unknown) => Promise<unknown>;
    expect(
      await claim({
        data: { intentId: baseIntent.id, sessionId: "cs_fixture" },
        context: { userId: "user_fixture", supabase: {} },
      }),
    ).toEqual({ status: "delivered", productKey: "coins_small" });
    expect(deps.pending).toHaveBeenCalledWith("user_fixture", "coins_small", "cs_fixture", 400);
    expect(deps.fulfill).toHaveBeenCalledWith(
      "user_fixture",
      "coins_small",
      "cs_fixture",
      500,
      { priceCents: 500, contents },
      400,
    );
  });
  it.each([
    { amount_total: 501 },
    { amount_total: -1 },
    { amount_total: null },
    { livemode: true },
    { currency: "usd" },
    { id: "cs_other" },
    { line_items: { ...baseSession.line_items, has_more: true } },
    { line_items: { data: [{ ...baseSession.line_items.data[0], quantity: 2 }] } },
    { line_items: { data: [{ ...baseSession.line_items.data[0], amount_subtotal: 400 }] } },
    {
      line_items: {
        data: [
          { ...baseSession.line_items.data[0], price: { id: "price_other", currency: "brl" } },
        ],
      },
    },
  ])("rejects mismatched provider data before delivery: %j", async (changed) => {
    deps.session.mockResolvedValue({ ...baseSession, ...changed });
    await expect(
      deliverClaimedGuestPurchase(baseIntent.id, "cs_fixture", "sandbox"),
    ).rejects.toThrow();
    expect(deps.pending).not.toHaveBeenCalled();
    expect(deps.fulfill).not.toHaveBeenCalled();
  });
  it("accepts a zero-total Stripe promotion but never a missing offer", () => {
    expect(
      validateGuestCheckoutOffer(
        { ...baseSession, amount_total: 0 } as never,
        baseIntent,
        "sandbox",
      ).paidAmount,
    ).toBe(0);
    expect(() =>
      validateGuestCheckoutOffer(
        baseSession as never,
        { ...baseIntent, contents_snapshot: null },
        "sandbox",
      ),
    ).toThrow();
  });
});
