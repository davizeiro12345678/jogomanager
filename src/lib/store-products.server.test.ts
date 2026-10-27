import { describe, expect, it, vi } from "vitest";
import { resolveValidatedStripePrice, type ServerStoreProduct } from "./store-products.server";

function product(overrides: Partial<ServerStoreProduct> = {}): ServerStoreProduct {
  return {
    key: "theme_pack", name: "Pacote de temas", description: "Itens digitais",
    priceCents: 1490, currency: "brl", kind: "cosmetic", active: true,
    stripeLookupKey: "theme_pack",
    contents: { coins: 0, scoutReports: 0, trainingBoosts: 0, themes: ["premium_gold"] },
    salePercentOff: 0, ...overrides,
  };
}

describe("server checkout commercial validation", () => {
  it("accepts known consumables and passes only when Stripe matches the catalog", async () => {
    const products = [
      product({ key: "coins_small", stripeLookupKey: "coins_small", kind: "coins", priceCents: 490, contents: { coins: 500, scoutReports: 0, trainingBoosts: 0, themes: [] } }),
      product({ key: "scout_pack", stripeLookupKey: "scout_pack", kind: "scout", priceCents: 990, contents: { coins: 0, scoutReports: 10, trainingBoosts: 0, themes: [] } }),
      product({ key: "training_pack", stripeLookupKey: "training_pack", kind: "training", priceCents: 990, contents: { coins: 0, scoutReports: 0, trainingBoosts: 1, themes: [] } }),
      product({ key: "season_pass", stripeLookupKey: "season_pass_monthly", kind: "pass", priceCents: 2490, contents: { coins: 0, scoutReports: 0, trainingBoosts: 0, themes: [] } }),
      product({ key: "bundle_starter", stripeLookupKey: "bundle_starter", kind: "bundle", priceCents: 990, contents: { coins: 500, scoutReports: 5, trainingBoosts: 2, themes: [] } }),
    ];
    const list = vi.fn().mockImplementation(async ({ lookup_keys }) => ({ data: [{ lookup_key: lookup_keys[0], unit_amount: products.find(p => p.stripeLookupKey === lookup_keys[0])?.priceCents, currency: "brl" }] }));
    const stripe = { prices: { list } } as never;
    for (const p of products) await expect(resolveValidatedStripePrice(stripe, p)).resolves.toMatchObject({ lookup_key: p.stripeLookupKey });
    expect(list).toHaveBeenCalledTimes(5);
  });

  it("rejects invalid SKU shapes before contacting Stripe", async () => {
    const list = vi.fn();
    const stripe = { prices: { list } } as never;
    await expect(resolveValidatedStripePrice(stripe, product({ kind: "coins", contents: { coins: -20, scoutReports: 0, trainingBoosts: 0, themes: [] } }))).rejects.toThrow(/contrato seguro/);
    expect(list).not.toHaveBeenCalled();
  });

  it("fails closed on a Stripe amount mismatch", async () => {
    const list = vi.fn().mockResolvedValue({ data: [{ lookup_key: "theme_pack", unit_amount: 1, currency: "brl" }] });
    await expect(resolveValidatedStripePrice({ prices: { list } } as never, product())).rejects.toThrow(/não confere/);
  });
});
