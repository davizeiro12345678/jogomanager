import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  environment: vi.fn(),
  verify: vi.fn(),
  stripe: vi.fn(),
  retrieveSession: vi.fn(),
  listSessions: vi.fn(),
  retrieveSubscription: vi.fn(),
  beginEvent: vi.fn(),
  finishEvent: vi.fn(),
  reconcileReview: vi.fn(),
  checkoutOffer: vi.fn(),
  isDelivered: vi.fn(),
  recordPending: vi.fn(),
  markFailed: vi.fn(),
  fulfill: vi.fn(),
  syncSubscription: vi.fn(),
  markGuestPaid: vi.fn(),
  markGuestFailed: vi.fn(),
  event: null as unknown,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/lib/stripe.server", () => ({
  getConfiguredStripeEnvironment: deps.environment,
  verifyWebhook: deps.verify,
  createStripeClient: deps.stripe,
}));
vi.mock("@/lib/fulfillment.server", () => ({
  recordPendingPurchase: deps.recordPending,
  markPurchaseFailed: deps.markFailed,
  fulfillOneTimePurchase: deps.fulfill,
  syncSubscription: deps.syncSubscription,
  beginPaymentEvent: deps.beginEvent,
  finishPaymentEvent: deps.finishEvent,
  reconcilePaymentReview: deps.reconcileReview,
  getAuthenticatedCheckoutOffer: deps.checkoutOffer,
  isPurchaseDelivered: deps.isDelivered,
}));
vi.mock("@/lib/guest-checkout.functions", () => ({
  markGuestCheckoutFailed: deps.markGuestFailed,
  markGuestCheckoutPaid: deps.markGuestPaid,
}));

import { Route } from "./webhook";

const post = (
  Route as unknown as {
    options: {
      server: {
        handlers: {
          POST(args: { request: Request }): Promise<Response>;
        };
      };
    };
  }
).options.server.handlers.POST;

function sessionEvent(type: string, session: Record<string, unknown>) {
  return { id: "evt_fixture", created: 1791540000, type, data: { object: session } };
}

function request() {
  return new Request("https://jogomanager.com/api/public/payments/webhook?env=sandbox", {
    method: "POST",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.environment.mockReturnValue("sandbox");
  deps.verify.mockImplementation(async () => deps.event);
  deps.beginEvent.mockResolvedValue(true);
  deps.isDelivered.mockResolvedValue(false);
  deps.finishEvent.mockResolvedValue(undefined);
  deps.checkoutOffer.mockResolvedValue({
    productKey: "coins_small",
    stripePriceId: "price_coins_small",
    currency: "BRL",
    snapshot: {
      priceCents: 500,
      contents: { coins: 1500, scoutReports: 0, trainingBoosts: 0, themes: [] },
    },
  });
  deps.listSessions.mockResolvedValue({ data: [{ id: "cs_test_review" }], has_more: false });
  deps.retrieveSession.mockResolvedValue({
    metadata: { userId: "user_1", productKey: "coins_small" },
    mode: "payment",
    currency: "brl",
    payment_status: "paid",
    amount_subtotal: 500,
    amount_total: 500,
    line_items: {
      data: [
        {
          quantity: 1,
          amount_subtotal: 500,
          amount_total: 500,
          price: { id: "price_coins_small", lookup_key: "coins_small" },
        },
      ],
      has_more: false,
    },
  });
  deps.stripe.mockReturnValue({
    checkout: { sessions: { retrieve: deps.retrieveSession, list: deps.listSessions } },
    subscriptions: { retrieve: deps.retrieveSubscription },
  });
});

describe("Stripe payment webhook lifecycle", () => {
  it("fulfills a paid one-time checkout from the server-resolved Stripe session", async () => {
    deps.event = sessionEvent("checkout.session.completed", {
      id: "cs_test_paid",
      mode: "payment",
      payment_status: "paid",
      metadata: { userId: "user_1", productKey: "coins_small" },
    });

    const response = await post({ request: request() });

    expect(response.status).toBe(200);
    expect(deps.verify).toHaveBeenCalledWith(expect.any(Request), "sandbox");
    expect(deps.retrieveSession).toHaveBeenCalledWith("cs_test_paid", {
      expand: ["line_items.data.price"],
    });
    expect(deps.recordPending).toHaveBeenCalledWith("user_1", "coins_small", "cs_test_paid", 500);
    expect(deps.fulfill).toHaveBeenCalledWith(
      "user_1",
      "coins_small",
      "cs_test_paid",
      500,
      expect.objectContaining({ priceCents: 500 }),
      500,
    );
  });

  it("keeps an unpaid checkout pending until Stripe confirms settlement", async () => {
    deps.event = sessionEvent("checkout.session.completed", {
      id: "cs_test_pending",
      mode: "payment",
      payment_status: "unpaid",
      metadata: { userId: "user_1", productKey: "coins_small" },
    });

    const response = await post({ request: request() });

    expect(response.status).toBe(200);
    expect(deps.recordPending).toHaveBeenCalledWith(
      "user_1",
      "coins_small",
      "cs_test_pending",
      500,
    );
    expect(deps.fulfill).not.toHaveBeenCalled();
  });

  it("marks an asynchronous payment denial as failed without granting the item", async () => {
    deps.event = sessionEvent("checkout.session.async_payment_failed", {
      id: "cs_test_denied",
      metadata: { userId: "user_1", productKey: "coins_small" },
    });

    const response = await post({ request: request() });

    expect(response.status).toBe(200);
    expect(deps.markFailed).toHaveBeenCalledWith("cs_test_denied", "Pagamento não foi concluído");
    expect(deps.fulfill).not.toHaveBeenCalled();
  });

  it("uses the same Stripe session reference when the successful webhook is delivered twice", async () => {
    deps.event = sessionEvent("checkout.session.completed", {
      id: "cs_test_replayed",
      mode: "payment",
      payment_status: "paid",
      metadata: { userId: "user_1", productKey: "coins_small" },
    });

    await post({ request: request() });
    await post({ request: request() });

    expect(deps.fulfill).toHaveBeenCalledTimes(2);
    expect(deps.fulfill).toHaveBeenNthCalledWith(
      1,
      "user_1",
      "coins_small",
      "cs_test_replayed",
      500,
      expect.objectContaining({ priceCents: 500 }),
      500,
    );
    expect(deps.fulfill).toHaveBeenNthCalledWith(
      2,
      "user_1",
      "coins_small",
      "cs_test_replayed",
      500,
      expect.objectContaining({ priceCents: 500 }),
      500,
    );
  });

  it("records a refund for review without revoking delivered benefits", async () => {
    deps.event = sessionEvent("charge.refunded", {
      id: "ch_test_refunded",
      payment_intent: "pi_test_refunded",
      amount_refunded: 200,
    });

    const response = await post({ request: request() });

    expect(response.status).toBe(200);
    expect(deps.markFailed).not.toHaveBeenCalled();
    expect(deps.fulfill).not.toHaveBeenCalled();
    expect(deps.syncSubscription).not.toHaveBeenCalled();
    expect(deps.listSessions).toHaveBeenCalledWith({
      payment_intent: "pi_test_refunded",
      limit: 100,
    });
    expect(deps.reconcileReview).toHaveBeenCalledWith({
      eventId: "evt_fixture",
      reference: "cs_test_review",
      type: "charge.refunded",
      created: 1791540000,
      refundedAmountCents: 200,
    });
  });

  it("reconciles a synchronous denial from the Stripe session reference", async () => {
    deps.event = sessionEvent("payment_intent.payment_failed", {
      id: "pi_test_declined",
      metadata: { userId: "user_1", productKey: "coins_small" },
    });

    const response = await post({ request: request() });

    expect(response.status).toBe(200);
    expect(deps.markFailed).not.toHaveBeenCalled();
    expect(deps.fulfill).not.toHaveBeenCalled();
    expect(deps.reconcileReview).toHaveBeenCalledWith({
      eventId: "evt_fixture",
      reference: "cs_test_review",
      type: "payment_intent.payment_failed",
      created: 1791540000,
      refundedAmountCents: 0,
    });
  });

  it("skips an event already completed in the durable journal", async () => {
    deps.beginEvent.mockResolvedValue(false);
    deps.event = sessionEvent("checkout.session.completed", { id: "cs_duplicate" });
    expect((await post({ request: request() })).status).toBe(200);
    expect(deps.retrieveSession).not.toHaveBeenCalled();
    expect(deps.fulfill).not.toHaveBeenCalled();
  });

  it("returns 503 and records retry when persistence fails after signature verification", async () => {
    deps.recordPending.mockRejectedValueOnce(new Error("temporary database outage"));
    deps.event = sessionEvent("checkout.session.completed", {
      id: "cs_retry",
      mode: "payment",
      payment_status: "paid",
      metadata: { userId: "user_1" },
    });
    const response = await post({ request: request() });
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(deps.finishEvent).toHaveBeenCalledWith("evt_fixture", false);
    expect(deps.fulfill).not.toHaveBeenCalled();
  });

  it("checks the list subtotal but records the actual discounted total", async () => {
    const session = await deps.retrieveSession();
    deps.retrieveSession.mockResolvedValue({ ...session, amount_total: 400 });
    deps.event = sessionEvent("checkout.session.completed", {
      id: "cs_coupon",
      mode: "payment",
      payment_status: "paid",
      metadata: { userId: "user_1" },
    });
    expect((await post({ request: request() })).status).toBe(200);
    expect(deps.recordPending).toHaveBeenCalledWith("user_1", "coins_small", "cs_coupon", 400);
    expect(deps.fulfill).toHaveBeenCalledWith(
      "user_1",
      "coins_small",
      "cs_coupon",
      500,
      expect.objectContaining({ priceCents: 500 }),
      400,
    );
  });

  it("resolves the latest subscription rather than replaying an older snapshot", async () => {
    const current = { id: "sub_fixture", status: "active", metadata: { userId: "user_1" } };
    deps.retrieveSubscription.mockResolvedValue(current);
    deps.event = sessionEvent("customer.subscription.updated", { ...current, status: "past_due" });
    expect((await post({ request: request() })).status).toBe(200);
    expect(deps.syncSubscription).toHaveBeenCalledWith(current, "sandbox");
  });

  it("rejects an invalid signature before writing any payment event", async () => {
    deps.verify.mockRejectedValueOnce(new Error("invalid signature"));
    expect((await post({ request: request() })).status).toBe(400);
    expect(deps.beginEvent).not.toHaveBeenCalled();
  });
  it("keeps already delivered legacy checkouts final without reconstructing a mutable offer", async () => {
    deps.isDelivered.mockResolvedValue(true);
    deps.event = sessionEvent("checkout.session.completed", {
      id: "cs_legacy",
      mode: "payment",
      payment_status: "paid",
      metadata: { userId: "user_1" },
    });
    expect((await post({ request: request() })).status).toBe(200);
    expect(deps.checkoutOffer).not.toHaveBeenCalled();
    expect(deps.fulfill).not.toHaveBeenCalled();
  });
  it("retries a transient immutable-offer lookup failure instead of using today's catalog", async () => {
    deps.checkoutOffer.mockRejectedValueOnce(new Error("temporary offer lookup failure"));
    deps.event = sessionEvent("checkout.session.completed", {
      id: "cs_offer_retry",
      mode: "payment",
      payment_status: "paid",
      metadata: { userId: "user_1" },
    });
    expect((await post({ request: request() })).status).toBe(503);
    expect(deps.finishEvent).toHaveBeenCalledWith("evt_fixture", false);
    expect(deps.fulfill).not.toHaveBeenCalled();
  });
});
