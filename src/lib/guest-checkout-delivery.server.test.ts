import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  database: vi.fn(),
  lookupIntent: vi.fn(),
  stripe: vi.fn(),
  retrieveSession: vi.fn(),
  recordPending: vi.fn(),
  fulfill: vi.fn(),
  syncSubscription: vi.fn(),
}));

vi.mock("@/lib/store-products.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-products.server")>()),
  getStoreServiceSupabase: deps.database,
}));
vi.mock("@/lib/stripe.server", () => ({ createStripeClient: deps.stripe }));
vi.mock("@/lib/fulfillment.server", () => ({
  recordPendingPurchase: deps.recordPending,
  fulfillOneTimePurchase: deps.fulfill,
  syncSubscriptionForUser: deps.syncSubscription,
}));

import { deliverClaimedGuestPurchase } from "./guest-checkout-delivery.server";

const contents = { coins: 1500, scoutReports: 0, trainingBoosts: 0, themes: [] };
const intent = {
  id: "intent_fixture",
  product_key: "coins_small",
  environment: "sandbox",
  state: "claimed",
  amount_cents: 500,
  currency: "BRL",
  contents_snapshot: contents,
  stripe_price_id: "price_fixture",
  stripe_session_id: "cs_test_fixture",
  claimed_by_user_id: "user_fixture",
};
const lineItem = {
  quantity: 1,
  amount_subtotal: 500,
  price: { id: "price_fixture", currency: "brl" },
};
const session = {
  id: intent.stripe_session_id,
  mode: "payment",
  livemode: false,
  metadata: { guestCheckoutIntentId: intent.id, productKey: intent.product_key },
  payment_status: "paid",
  currency: "brl",
  amount_total: 400,
  line_items: { data: [lineItem], has_more: false },
};

function deliver() {
  return deliverClaimedGuestPurchase(intent.id, intent.stripe_session_id, "sandbox");
}

beforeEach(() => {
  vi.resetAllMocks();
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: deps.lookupIntent,
  };
  deps.database.mockReturnValue({ from: vi.fn(() => query) });
  deps.lookupIntent.mockResolvedValue({ data: intent, error: null });
  deps.stripe.mockReturnValue({ checkout: { sessions: { retrieve: deps.retrieveSession } } });
  deps.retrieveSession.mockResolvedValue(session);
});

describe("delivery of claimed guest checkouts", () => {
  it.each([
    ["paid", 400],
    ["no_payment_required", 0],
  ] as const)("records the settled total for a %s session", async (status, total) => {
    deps.retrieveSession.mockResolvedValue({
      ...session,
      payment_status: status,
      amount_total: total,
    });

    await deliver();

    expect(deps.recordPending).toHaveBeenCalledWith(
      intent.claimed_by_user_id,
      intent.product_key,
      session.id,
      total,
    );
    expect(deps.fulfill).toHaveBeenCalledWith(
      intent.claimed_by_user_id,
      intent.product_key,
      session.id,
      intent.amount_cents,
      { priceCents: intent.amount_cents, contents: expect.objectContaining(contents) },
      total,
    );
  });

  it.each([
    { livemode: true },
    { id: "cs_test_unrelated" },
    { currency: "usd" },
    { line_items: { data: [lineItem, lineItem], has_more: false } },
    { line_items: { data: [lineItem], has_more: true } },
    { line_items: { data: [{ ...lineItem, quantity: 2 }], has_more: false } },
    { amount_total: null },
    { amount_total: -1 },
    { amount_total: 2_147_483_648 },
  ])(
    "rejects an inconsistent provider response before writing a purchase (%j)",
    async (changes) => {
      deps.retrieveSession.mockResolvedValue({ ...session, ...changes });

      await expect(deliver()).rejects.toThrow();

      expect(deps.recordPending).not.toHaveBeenCalled();
      expect(deps.fulfill).not.toHaveBeenCalled();
    },
  );

  it("keeps pending payments and unclaimed offers out of the wallet", async () => {
    deps.retrieveSession.mockResolvedValue({ ...session, payment_status: "unpaid" });
    await deliver();

    deps.retrieveSession.mockClear();
    deps.lookupIntent.mockResolvedValue({ data: { ...intent, state: "paid" }, error: null });
    await deliver();

    expect(deps.retrieveSession).not.toHaveBeenCalled();
    expect(deps.recordPending).not.toHaveBeenCalled();
    expect(deps.fulfill).not.toHaveBeenCalled();
  });
});
