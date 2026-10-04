import { describe, expect, it } from "vitest";

import {
  assertStoreProductKey,
  isValidCheckoutSubtotal,
  isValidPaidAmount,
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

  it("aceita descontos e impostos usando o subtotal original verificado pela Stripe", () => {
    expect(isValidCheckoutSubtotal(1290, 1290)).toBe(true);
    expect(isValidPaidAmount(1000)).toBe(true);
    expect(isValidPaidAmount(1500)).toBe(true); // valor final pode incluir imposto
  });

  it("rejeita subtotal alterado e totais pagos inválidos", () => {
    expect(isValidCheckoutSubtotal(0, 1290)).toBe(false);
    expect(isValidCheckoutSubtotal(1291, 1290)).toBe(false);
    expect(isValidCheckoutSubtotal(-1, 1290)).toBe(false);
    expect(isValidCheckoutSubtotal(1290.5, 1290)).toBe(false);
    expect(isValidPaidAmount(-1)).toBe(false);
    expect(isValidPaidAmount(Number.NaN)).toBe(false);
    expect(isValidPaidAmount(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });
});
