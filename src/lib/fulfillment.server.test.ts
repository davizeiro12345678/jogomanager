import { describe, expect, it } from "vitest";

import {
  assertStoreProductKey,
  calculateCheckoutPriceCents,
  parseStoreProductContents,
} from "./store-products.server";

describe("server store-product contract", () => {
  it("normaliza conteúdos completos e deduplica temas repetidos", () => {
    expect(
      parseStoreProductContents({
        coins: 1500,
        scoutReports: 10,
        trainingBoosts: 1,
        themes: ["premium_gold", "premium_gold"],
      }),
    ).toEqual({
      coins: 1500,
      scoutReports: 10,
      trainingBoosts: 1,
      themes: ["premium_gold"],
    });
  });

  it("recusa campos ausentes ou com tipos inválidos", () => {
    expect(
      parseStoreProductContents({
        coins: 0,
        scoutReports: 0,
        trainingBoosts: 0,
        themes: [42],
      }),
    ).toBeNull();
    expect(parseStoreProductContents({ coins: 0, themes: [] })).toBeNull();
  });

  it("recusa um produto ou conteúdo inválido antes de abrir checkout", () => {
    expect(parseStoreProductContents(null)).toBeNull();
    expect(parseStoreProductContents([])).toBeNull();
    expect(() => assertStoreProductKey("../coins")).toThrow("Produto inválido");
    expect(() => assertStoreProductKey("coins_small")).not.toThrow();
  });

  it("usa o mesmo arredondamento da vitrine para o valor cobrado", () => {
    expect(calculateCheckoutPriceCents(490, 10)).toBe(441);
    expect(calculateCheckoutPriceCents(1290, 15)).toBe(1097);
    expect(calculateCheckoutPriceCents(490, 0)).toBe(490);
  });

  it("recusa descontos e preços impossíveis", () => {
    expect(() => calculateCheckoutPriceCents(-1, 10)).toThrow("Preço inválido");
    expect(() => calculateCheckoutPriceCents(490, 91)).toThrow("Desconto inválido");
  });
});
