import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  environment: vi.fn(),
  verify: vi.fn(),
  stripe: vi.fn(),
  retrieveSession: vi.fn(),
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
  return { type, data: { object: session } };
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
  deps.retrieveSession.mockResolvedValue({
    metadata: { productKey: "coins_small" },
    amount_total: 500,
    line_items: {
      data: [{ amount_total: 500, price: { id: "price_coins_small", lookup_key: "coins_small" } }],
    },
  });
  deps.stripe.mockReturnValue({
    checkout: { sessions: { retrieve: deps.retrieveSession } },
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
    expect(deps.fulfill).toHaveBeenCalledWith("user_1", "coins_small", "cs_test_paid", 500);
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
    );
    expect(deps.fulfill).toHaveBeenNthCalledWith(
      2,
      "user_1",
      "coins_small",
      "cs_test_replayed",
      500,
    );
  });

  it("currently acknowledges a refund event without reconciling the refunded purchase", async () => {
    deps.event = sessionEvent("charge.refunded", {
      id: "ch_test_refunded",
      payment_intent: "pi_test_refunded",
    });

    const response = await post({ request: request() });

    expect(response.status).toBe(200);
    expect(deps.markFailed).not.toHaveBeenCalled();
    expect(deps.fulfill).not.toHaveBeenCalled();
    expect(deps.syncSubscription).not.toHaveBeenCalled();
  });

  it("currently ignores Stripe's synchronous card-declined event", async () => {
    deps.event = sessionEvent("payment_intent.payment_failed", {
      id: "pi_test_declined",
      metadata: { userId: "user_1", productKey: "coins_small" },
    });

    const response = await post({ request: request() });

    expect(response.status).toBe(200);
    expect(deps.markFailed).not.toHaveBeenCalled();
    expect(deps.fulfill).not.toHaveBeenCalled();
  });
});
