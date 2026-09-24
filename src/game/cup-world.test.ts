import { describe, expect, it } from "vitest";
import { createCups, playCupStage } from "./cup";
import { initCareer } from "./career";
import { CLUBS } from "./data/leagues";

describe("copas mundiais", () => {
  const top = Object.values(CLUBS).sort((a, b) => b.strength - a.strength)[0]!;
  it("Supermundial: 32 clubes únicos em 8 grupos e termina com campeão", () => {
    const base = initCareer(top.league, top.id, "Teste");
    const state = { ...base, season: 2028 };
    const cup = createCups(state).find((c) => c.id === "club_world_cup");
    expect(cup).toBeTruthy();
    const ids = cup!.groups!.flatMap((g) => g.clubIds);
    expect(cup!.groups!.length).toBe(8);
    expect(new Set(ids).size).toBe(32);
    let c = { ...cup!, out: false };
    for (let i = 0; i < 10 && !c.winner; i++) {
      const r = playCupStage({ ...c, out: false }, state);
      c = r.cup;
    }
    expect(c.winner).toBeTruthy();
  });
  it("Intercontinental só aparece para o campeão continental", () => {
    const base = initCareer(top.league, top.id, "Teste");
    const s = { ...base, season: 2027 };
    expect(createCups(s).some((c) => c.id === "intercontinental")).toBe(false);
    const cont = createCups(s).find((c) => c.id === "continental")!.name;
    const won = { ...s, trophies: [{ season: 2026, name: cont }] };
    const inter = createCups(won).find((c) => c.id === "intercontinental");
    expect(inter?.ties.length).toBe(2);
  });
});
