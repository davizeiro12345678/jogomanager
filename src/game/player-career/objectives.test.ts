import { describe, expect, it } from "vitest";
import { CLUBS } from "@/game/data/leagues";
import { createAthlete, advanceWeek, seasonLength } from "./engine";
import { seasonObjectives, seasonObjectiveSummary } from "./objectives";

const clubId = Object.keys(CLUBS)[0]!;
const make = (position: "GOL" | "ATA" = "ATA") =>
  createAthlete({
    slot: 1,
    name: "Camila Santos",
    nickname: "Camila",
    nation: "Brasil",
    hometown: "Vitória",
    position,
    foot: "direito",
    heightCm: 178,
    build: "atletico",
    personality: "profissional",
    origin: "base",
    clubId,
    appearance: { skin: 2, hair: 1, hairColor: 0, beard: 0, boots: 0 },
    shirtNumber: 10,
  }, 1000);

describe("objetivos da carreira de jogador", () => {
  it("diferencia papéis: goleiro é medido por titularidades, atacante por participações", () => {
    const striker = seasonObjectives(make("ATA"), 32);
    const keeper = seasonObjectives(make("GOL"), 32);
    expect(striker[1]?.title).toBe("Participar dos gols");
    expect(keeper[1]?.title).toBe("Consolidar a titularidade");
    expect(keeper[2]?.target).toBeLessThan(striker[2]!.target);
  });

  it("não confunde a média de uma única partida com regularidade", () => {
    const career = make();
    career.current.apps = 1;
    career.current.ratingSum = 10;
    expect(seasonObjectives(career, 30)[2]?.complete).toBe(false);
    career.current.apps = 4;
    career.current.ratingSum = 32;
    expect(seasonObjectives(career, 30)[2]?.complete).toBe(true);
  });

  it("mantém metas determinísticas e consequências previsíveis sem alterar o save original", () => {
    const original = make();
    const before = structuredClone(original);
    expect(seasonObjectives(original, 30)).toEqual(seasonObjectives(original, 30));
    expect(original).toEqual(before);
    const weeks = seasonLength(original);
    let a = original;
    let b = original;
    for (let week = 0; week < weeks; week++) {
      a = advanceWeek(a, { focus: ["tecnico"], intensity: "normal" }, 2000 + week);
      b = advanceWeek(b, { focus: ["tecnico"], intensity: "normal" }, 2000 + week);
    }
    expect(a).toEqual(b);
    expect(a.season).toBe(2);
    expect(seasonObjectiveSummary(a, seasonLength(a)).total).toBe(3);
    expect(a.news.some((entry) => entry.title.includes("Metas da temporada"))).toBe(true);
  });
});
