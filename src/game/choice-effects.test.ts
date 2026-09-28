import { describe, expect, it } from "vitest";

import type { CareerState, Player } from "./types";
import { applyChoiceEffect } from "./choice-effects";

function career(): CareerState {
  const mk = (id: string, morale: number): Player =>
    ({ id, name: id, morale, condition: 80 }) as Player;
  return {
    season: 1,
    round: 4,
    players: { a: mk("a", 60), b: mk("b", 97) },
    approval: 50,
    fanApproval: 60,
    pressure: 25,
    news: [],
  } as unknown as CareerState;
}

describe("choice-effects", () => {
  it("moral da escolha pega no elenco inteiro", () => {
    const next = applyChoiceEffect(career(), { morale: 6 });
    expect(next.players["a"]!.morale).toBe(66);
    expect(next.players["b"]!.morale).toBe(100);
  });

  it("trava tudo entre 0 e 100", () => {
    const next = applyChoiceEffect(career(), {
      morale: -200,
      approval: 500,
      pressure: -500,
    });
    expect(next.players["a"]!.morale).toBe(0);
    expect(next.approval).toBe(100);
    expect(next.pressure).toBe(0);
  });

  it("manchete vira notícia de vestiário", () => {
    const next = applyChoiceEffect(career(), { headline: "Treinador promete renovação" });
    expect(next.news[0]!.kind).toBe("vestiario");
    expect(next.news[0]!.title).toBe("Treinador promete renovação");
  });

  it("sem efeito não mexe em nada", () => {
    const s = career();
    const next = applyChoiceEffect(s, {});
    expect(next.players["a"]!.morale).toBe(60);
    expect(next.approval).toBe(50);
    expect(next.news).toHaveLength(0);
  });
});
