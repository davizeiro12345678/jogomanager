import { describe, expect, it } from "vitest";
import { CLUBS } from "@/game/data/leagues";
import { createAthlete } from "@/game/player-career/engine";
import { AthleteMutationResult, AthleteMutationSchema } from "./player-career-schema";

const clubId = Object.keys(CLUBS)[0]!;

function athlete() {
  return createAthlete(
    {
      slot: 1,
      name: "Atleta de teste",
      nickname: "Atleta",
      nation: "Brasil",
      hometown: "Vitória",
      position: "ATA",
      foot: "direito",
      heightCm: 180,
      build: "atletico",
      personality: "profissional",
      origin: "base",
      clubId,
      appearance: { skin: 2, hair: 1, hairColor: 0, beard: 0, boots: 0 },
      shirtNumber: 9,
    },
    1000,
  );
}

function accepted(state: unknown, slot = 1, expectedRevision = 0) {
  return AthleteMutationSchema.safeParse({ slot, expectedRevision, state }).success;
}

describe("contrato de save de atleta", () => {
  it("aceita um save de verdade e a revisão do servidor", () => {
    expect(accepted(athlete())).toBe(true);
    expect(AthleteMutationResult.parse([{ status: "applied", new_revision: 1 }])).toEqual([
      { status: "applied", new_revision: 1 },
    ]);
  });

  it("rejeita mudanças de slot e tipos adulterados no JSON", () => {
    const valid = athlete();
    expect(accepted(valid, 2)).toBe(false);
    const attrs = { ...valid.attrs, finalizacao: "999" };
    expect(accepted({ ...valid, attrs })).toBe(false);
  });

  it("rejeita revisões e ofertas adulteradas", () => {
    const valid = athlete();
    expect(accepted(valid, 1, -1)).toBe(false);
    const offer = {
      id: "x",
      clubId,
      salary: 1000,
      years: 2,
      loan: false,
      negotiationRounds: 99,
    };
    expect(accepted({ ...valid, offers: [offer] })).toBe(false);
  });

  it("impõe limite de tamanho aos eventos persistidos", () => {
    const valid = athlete();
    const item = { id: "x", season: 1, week: 1, title: "x", tone: "good" };
    expect(accepted({ ...valid, news: Array(200).fill(item) })).toBe(false);
  });
});
