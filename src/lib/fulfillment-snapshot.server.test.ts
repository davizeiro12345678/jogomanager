import { beforeEach, describe, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({
  rpc: vi.fn(),
  catalog: vi.fn(),
  service: vi.fn(),
  query: vi.fn(),
  upsert: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("./store-products.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./store-products.server")>()),
  getStoreServiceSupabase: deps.service,
  getServerStoreProduct: deps.catalog,
}));
vi.mock("./slack.server", () => ({ notifySlack: deps.notify }));
import {
  fulfillOneTimePurchase,
  getAuthenticatedCheckoutOffer,
  recordPendingPurchase,
  syncSubscriptionForUser,
} from "./fulfillment.server";
const paidContents = { coins: 1500, scoutReports: 2, trainingBoosts: 0, themes: ["premium_gold"] };
beforeEach(() => {
  vi.resetAllMocks();
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) chain[method] = vi.fn(() => chain);
  chain["maybeSingle"] = deps.query;
  chain["upsert"] = deps.upsert;
  deps.service.mockReturnValue({ rpc: deps.rpc, from: vi.fn(() => chain) });
  deps.rpc.mockResolvedValue({ data: true, error: null });
  deps.upsert.mockResolvedValue({ error: null });
  deps.query.mockResolvedValue({
    data: {
      product_key: "coins_small",
      price_cents: 500,
      currency: "BRL",
      stripe_price_id: "price_original",
      contents_snapshot: paidContents,
    },
    error: null,
  });
  // Today's changed catalog must never be used to deliver an older offer.
  deps.catalog.mockResolvedValue({ priceCents: 900, contents: { ...paidContents, coins: 9000 } });
});
describe("immutable authenticated offer delivery", () => {
  it("loads the session-bound offer and delivers its original benefits after catalog drift", async () => {
    const offer = await getAuthenticatedCheckoutOffer("user_fixture", "cs_fixture", "sandbox");
    expect(
      await fulfillOneTimePurchase(
        "user_fixture",
        offer.productKey,
        "cs_fixture",
        500,
        offer.snapshot,
        400,
      ),
    ).toBe(true);
    expect(deps.catalog).not.toHaveBeenCalled();
    expect(deps.rpc).toHaveBeenCalledWith(
      "fulfill_store_purchase",
      expect.objectContaining({
        _amount_cents: 400,
        _coins: 1500,
        _scout_reports: 2,
        _themes: ["premium_gold"],
      }),
    );
  });
  it("fails closed for a legacy offer that has no historical snapshot", async () => {
    deps.query.mockResolvedValue({
      data: { product_key: null, price_cents: null, contents_snapshot: null },
      error: null,
    });
    await expect(
      getAuthenticatedCheckoutOffer("user_fixture", "cs_legacy", "sandbox"),
    ).rejects.toThrow(/revisão da oferta/);
    expect(deps.catalog).not.toHaveBeenCalled();
  });
  it("propagates transient persistence failures for webhook retry", async () => {
    deps.query.mockResolvedValue({ data: null, error: { message: "temporary outage" } });
    await expect(
      getAuthenticatedCheckoutOffer("user_fixture", "cs_fixture", "sandbox"),
    ).rejects.toThrow(/será repetido/);
    deps.upsert.mockResolvedValue({ error: { message: "temporary outage" } });
    await expect(
      recordPendingPurchase("user_fixture", "coins_small", "cs_fixture", 500),
    ).rejects.toThrow(/compra pendente/);
  });
  it("keeps duplicate credit control inside the atomic RPC", async () => {
    deps.rpc.mockResolvedValue({ data: false, error: null });
    expect(
      await fulfillOneTimePurchase("user_fixture", "coins_small", "cs_fixture", 500, {
        priceCents: 500,
        contents: paidContents,
      }),
    ).toBe(false);
    expect(deps.notify).not.toHaveBeenCalled();
  });
  it("reconciles all subscriptions after each webhook instead of overwriting the shared pass", async () => {
    await syncSubscriptionForUser(
      {
        id: "sub_old",
        customer: "cus_fixture",
        status: "canceled",
        cancel_at_period_end: true,
        items: {
          data: [
            {
              current_period_start: 1_790_000_000,
              current_period_end: 1_800_000_000,
              price: {
                id: "price_fixture",
                lookup_key: null,
                metadata: {},
                product: "prod_fixture",
              },
            },
          ],
        },
      } as never,
      "user_fixture",
      "sandbox",
    );
    expect(deps.rpc).toHaveBeenCalledWith("reconcile_subscription_wallet", {
      _user_id: "user_fixture",
      _environment: "sandbox",
    });
  });
});
