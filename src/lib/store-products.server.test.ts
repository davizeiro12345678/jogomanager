import { describe, expect, it, vi } from "vitest";

import { resolveValidatedStripePrice, type ServerStoreProduct } from "./store-products.server";

function product(overrides: Partial<ServerStoreProduct> = {}): ServerStoreProduct {
  return {
    key: "theme_pack",
    name: "Pacote de temas",
    description: "Cosméticos sem vantagem competitiva",
    priceCents: 1990,
    currency: "brl",
    kind: "cosmetic",
    active: true,
    stripeLookupKey: "theme_pack",
    contents: { coins: 0, scoutReports: 0, trainingBoosts: 0, themes: ["premium_gold"] },
    salePercentOff: 0,
    ...overrides,
  };
}

describe("server checkout anti-pay-to-win gate", () => {
  it("blocks legacy currency, scouting, training and pass products before Stripe price lookup", async () => {
    const list = vi.fn();
    const stripe = { prices: { list } } as never;

    for (const legacyProduct of [
      product({
        key: "coins_small",
        kind: "coins",
        contents: { coins: 500, scoutReports: 0, trainingBoosts: 0, themes: [] },
      }),
      product({
        key: "scout_pack",
        kind: "scout",
        contents: { coins: 0, scoutReports: 10, trainingBoosts: 0, themes: [] },
      }),
      product({
        key: "training_pack",
        kind: "training",
        contents: { coins: 0, scoutReports: 0, trainingBoosts: 1, themes: [] },
      }),
      product({
        key: "season_pass",
        kind: "pass",
        contents: { coins: 0, scoutReports: 0, trainingBoosts: 0, themes: [] },
      }),
    ]) {
      await expect(resolveValidatedStripePrice(stripe, legacyProduct)).rejects.toThrow(
        /anti-pay-to-win/i,
      );
    }

    expect(list).not.toHaveBeenCalled();
  });

  it("keeps a purely cosmetic product eligible for validated checkout price lookup", async () => {
    const list = vi.fn().mockResolvedValue({
      data: [{ lookup_key: "theme_pack", unit_amount: 1990, currency: "brl" }],
    });
    const stripe = { prices: { list } } as never;

    await expect(resolveValidatedStripePrice(stripe, product())).resolves.toMatchObject({
      lookup_key: "theme_pack",
      unit_amount: 1990,
    });
    expect(list).toHaveBeenCalledWith({ lookup_keys: ["theme_pack"], active: true, limit: 2 });
  });
});
