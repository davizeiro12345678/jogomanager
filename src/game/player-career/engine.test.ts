import { describe, expect, it } from "vitest";
import { CLUBS } from "@/game/data/leagues";
import { advanceWeek, careerTotals, createAthlete, overall, seasonLength } from "./engine";

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
