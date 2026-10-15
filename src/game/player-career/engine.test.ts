import { describe, expect, it } from "vitest";
import { CLUBS } from "@/game/data/leagues";
import {
  advanceWeek,
  buildMoments,
  careerTotals,
  createAthlete,
  negotiateOffer,
  overall,
  seasonLength,
  trainingOutlook,
} from "./engine";

const clubId = Object.keys(CLUBS)[0]!;
const make = () =>
  createAthlete(
    {
      slot: 1,
      name: "Teste da Silva",
      nickname: "Teste",
      nation: "Brasil",
      hometown: "Rio",
      position: "ATA",
      foot: "direito",
      heightCm: 182,
      build: "atletico",
      personality: "profissional",
      origin: "base",
      clubId,
      appearance: { skin: 2, hair: 1, hairColor: 0, beard: 0, boots: 0 },
      shirtNumber: 9,
    },
    1000,
  );

describe("carreira de jogador", () => {
  it("é determinística", () => {
    const a = advanceWeek(make(), { focus: ["tecnico", "fisico"], intensity: "normal" }, 1);
    const b = advanceWeek(make(), { focus: ["tecnico", "fisico"], intensity: "normal" }, 1);
    expect(a).toEqual(b);
  });

  it("limita a negociação de contrato a uma contraproposta sem perder o determinismo", () => {
    const original = make();
    const newClubId = Object.keys(CLUBS).find((id) => id !== original.clubId)!;
    original.offers = [
      { id: "test-offer", clubId: newClubId, salary: 2000, years: 3, loan: false },
    ];
    const a = negotiateOffer(original, "test-offer", 2000);
    const b = negotiateOffer(original, "test-offer", 2000);
    expect(a).toEqual(b);
    // O save original não muda enquanto uma negociação está sendo calculada.
    expect(original.offers[0]?.negotiationRounds).toBeUndefined();
    if (a.accepted) {
      expect(a.state.offers[0]?.salary).toBe(2300);
      expect(a.state.offers[0]?.negotiationRounds).toBe(1);
      expect(a.state.updatedAt).toBe(2000);
      const again = negotiateOffer(a.state, "test-offer", 3000);
      expect(again.accepted).toBe(false);
      expect(again.state).toEqual(a.state);
    } else {
      expect(a.state.offers).toHaveLength(0);
    }
  });

  it("oferece lances variados por posição sem exigir carrinho do goleiro", () => {
    const goalkeeper = { ...make(), position: "GOL" as const, week: 8 };
    const chances = buildMoments(goalkeeper);
    expect(buildMoments(goalkeeper)).toEqual(chances);
    expect(chances.length).toBeGreaterThanOrEqual(3);
    expect(chances.length).toBeLessThanOrEqual(4);
    expect(chances.every((moment) => moment.options.every((choice) => choice.attr !== "carrinho"))).toBe(
      true,
    );
    expect(
      chances.every((moment) =>
        moment.options.some(
          (choice) =>
            choice.reward === "save" || choice.reward === "keep" || choice.reward === "assist",
        ),
      ),
    ).toBe(true);
  });

  it("projeta energia e risco do mesmo modo que a simulação", () => {
    const tired = { ...make(), energy: 15 };
    expect(trainingOutlook(tired, "pesado")).toMatchObject({
      energyAfter: 10,
      injuryRisk: 0.07,
    });
    expect(trainingOutlook(tired, "leve").energyAfter).toBe(27);
    expect(trainingOutlook({ ...tired, injury: { label: "Lesão", weeksLeft: 2 } }, "pesado")
      .injuryRisk).toBe(0);
  });

  it("evolui ao longo de temporadas e envelhece", () => {
    let s = make();
    const start = overall(s);
    const weeks = seasonLength(s) * 3;
    for (let i = 0; i < weeks && !s.retired; i++)
      s = advanceWeek(s, { focus: ["tecnico", "mental"], intensity: "normal" }, i);
    expect(s.age).toBeGreaterThanOrEqual(19);
    expect(overall(s)).toBeGreaterThan(start);
    expect(careerTotals(s).apps).toBeGreaterThanOrEqual(0);
  });
});
