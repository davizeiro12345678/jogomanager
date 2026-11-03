import { describe, expect, it } from "vitest";

import { assertStoreProductKey, parseStoreProductContents } from "./store-products.server";

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
      injuryTreatments: 0,
      opponentReports: 0,
      themes: ["premium_gold"],
    });
  });

  it("lê tratamentos e relatórios do adversário dos pacotes de serviço", () => {
    expect(
      parseStoreProductContents({
        coins: 0,
        scoutReports: 0,
        trainingBoosts: 0,
        injuryTreatments: 5,
        opponentReports: 10,
        themes: [],
      }),
    ).toMatchObject({ injuryTreatments: 5, opponentReports: 10 });
    expect(
      parseStoreProductContents({
        coins: 0,
        scoutReports: 0,
        trainingBoosts: 0,
        injuryTreatments: -1,
        themes: [],
      }),
    ).toBeNull();
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
});
