import { describe, expect, it } from "vitest";

import type { CareerState, Player } from "./types";
import { applyChoiceEffect } from "./choice-effects";
import type { CutsceneChoiceReaction } from "./cutscene-choice";
import { worldFor } from "./career-world";

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

function relationshipCareer(): CareerState {
  const base = career();
  const captain: Player = {
    ...(base.players["a"] as Player),
    id: "captain",
    name: "Capitão",
    clubId: "club",
    age: 27,
    morale: 60,
    personality: "temperamental",
  };
  return {
    ...base,
    clubId: "club",
    managerName: "Davi",
    players: { captain },
  } as CareerState;
}

function reaction(overrides: Partial<CutsceneChoiceReaction> = {}): CutsceneChoiceReaction {
  return {
    decisionId: "unhappy-knock.choice.01",
    responder: "captain",
    playerId: "captain",
    personality: "temperamental",
    trust: 55,
    respect: 50,
    receptivity: 0.8,
    support: 0.86,
    resistance: 0.14,
    moraleDelta: 2,
    trustDelta: 3,
    respectDelta: 1,
    warmth: 0.8,
    tension: 0.2,
    relationship: "connected",
    ...overrides,
  };
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

  it("persiste apenas uma reação limitada do jogador após aplicar o efeito authored", () => {
    const before = relationshipCareer();
    const bond = worldFor(before).relationships["captain"]!;
    const next = applyChoiceEffect(before, { morale: 1 }, reaction());
    expect(next.players["captain"]!.morale).toBe(63);
    expect(next.world!.relationships["captain"]!.trust).toBe(bond.trust + 3);
    expect(next.world!.relationships["captain"]!.respect).toBe(bond.respect + 1);
    expect(next.world!.relationships["captain"]!.lastTalk).toBe("club:1:4");
    expect(next.world!.memories[0]).toMatchObject({
      kind: "relationship",
      playerId: "captain",
      sentiment: 5,
    });

    const repeated = applyChoiceEffect(next, {}, reaction());
    expect(repeated.players["captain"]!.morale).toBe(next.players["captain"]!.morale);
    expect(repeated.world!.relationships["captain"]).toEqual(next.world!.relationships["captain"]);
    expect(repeated.world!.memories).toHaveLength(next.world!.memories.length);
  });

  it("limita a resistência de uma escolha para não reescrever moral ou vínculo", () => {
    const before = relationshipCareer();
    const bond = worldFor(before).relationships["captain"]!;
    const next = applyChoiceEffect(
      before,
      {},
      reaction({
        decisionId: "unhappy-knock.choice.02",
        support: 0,
        resistance: 1,
        moraleDelta: -99,
        trustDelta: -99,
        respectDelta: -99,
        relationship: "strained",
      }),
    );
    expect(next.players["captain"]!.morale).toBe(57);
    expect(next.world!.relationships["captain"]!.trust).toBe(bond.trust - 4);
    expect(next.world!.relationships["captain"]!.respect).toBe(bond.respect - 2);
  });
});
