import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  rpc: vi.fn(),
  insert: vi.fn(),
  createSession: vi.fn(),
  createStripe: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      validator: (validate: (input: unknown) => unknown) => ({
        handler:
          (handle: (args: { data: unknown; context: unknown }) => unknown) =>
          async (args: { data: unknown; context: unknown }) =>
            handle({ ...args, data: validate(args.data) }),
      }),
    }),
  }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: vi.fn() }));
vi.mock("@/lib/payments-config.server", () => ({
  assertPaymentsConfigured: () => "sandbox",
  PAYMENTS_UNAVAILABLE: "Pagamentos indisponíveis",
}));
vi.mock("@/lib/stripe.server", () => ({
  createStripeClient: deps.createStripe,
  getConfiguredStripeEnvironment: () => "sandbox",
  getStripeErrorMessage: (error: unknown) => (error instanceof Error ? error.message : "Erro"),
}));
vi.mock("@/lib/store-products.server", () => ({
  assertStoreProductKey: vi.fn(),
  getServerStoreProduct: async () => ({
    key: "coins",
    priceCents: 100,
    currency: "BRL",
    contents: {},
  }),
  getStoreServiceSupabase: () => ({ rpc: deps.rpc, from: () => ({ insert: deps.insert }) }),
  resolveValidatedStripePrice: async () => ({ id: "price_1", type: "one_time", product: "prod_1" }),
  checkoutDiscountParams: async () => ({}),
}));

import { createCheckoutSession } from "./payments.functions";
const checkout = createCheckoutSession as unknown as (args: {
  data: { productKey: string; returnUrl: string; clientEnvironment: "sandbox" };
  context: { userId: string; claims: Record<string, unknown> };
}) => Promise<{ clientSecret?: string; error?: string }>;
const attempt = (userId = "user-a") =>
  checkout({
    data: {
      productKey: "coins",
      returnUrl: "https://jogomanager.com/checkout/return",
      clientEnvironment: "sandbox",
    },
    context: { userId, claims: {} },
  });

beforeEach(() => {
  vi.clearAllMocks();
  deps.rpc.mockResolvedValue({ data: true, error: null });
  deps.insert.mockResolvedValue({ error: null });
  deps.createSession.mockResolvedValue({ id: "cs_test_1", client_secret: "secret" });
  deps.createStripe.mockReturnValue({
    customers: { search: async () => ({ data: [{ id: "cus_1" }] }) },
    products: { retrieve: async () => ({ name: "Coins" }) },
    checkout: { sessions: { create: deps.createSession } },
  });
});

describe("authenticated checkout attempt limit", () => {
  it("reserves a stable account-specific key before creating a session", async () => {
    expect(await attempt()).toEqual({ clientSecret: "secret" });
    const key = deps.rpc.mock.calls[0]?.[1]?._email_hash as string;
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("user-a");
    expect(deps.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      deps.createSession.mock.invocationCallOrder[0]!,
    );
    await attempt("user-b");
    expect(deps.rpc.mock.calls[1]?.[1]?._email_hash).not.toEqual(key);
  });

  it("does not create a Stripe session when the limit is exhausted", async () => {
    deps.rpc.mockResolvedValue({ data: false, error: null });
    expect((await attempt()).error).toMatch(/tentativas/i);
    expect(deps.createStripe).not.toHaveBeenCalled();
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  it("fails closed when the shared limit cannot be checked", async () => {
    deps.rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    expect((await attempt()).error).toMatch(/limite/i);
    expect(deps.createSession).not.toHaveBeenCalled();
  });
});
