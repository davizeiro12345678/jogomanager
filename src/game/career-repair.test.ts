import { describe, expect, it } from "vitest";
import { newCareer } from "./career";
import { repairCareer } from "./career-repair";
import { LEAGUES } from "./data/leagues";

const fresh = () => newCareer(LEAGUES[0]!.clubs[0]!.id, "Teste");

describe("repairCareer", () => {
  it("não mexe em uma carreira nova", () => {
    const s = fresh();
    const r = repairCareer(s);
    expect(r.fixes).toEqual([]);
    expect(r.state).toBe(s);
  });

  it("conserta atributos, escalação, calendário e medidores", () => {
    const s = fresh();
    const pid = s.lineup[0]!;
    const broken = {
      ...s,
      players: { ...s.players, [pid]: { ...s.players[pid]!, ovr: 140, condition: Number.NaN } },
      lineup: [...s.lineup.slice(0, 9), "fantasma", s.lineup[0]!],
      fixtures: [
        ...s.fixtures,
        s.fixtures[0]!,
        { ...s.fixtures[1]!, homeGoals: 2, awayGoals: null },
      ],
      approval: 180,
    };
    const r = repairCareer(broken);
    expect(r.state.players[pid]!.ovr).toBe(99);
    expect(r.state.players[pid]!.condition).toBe(100);
    expect(r.state.lineup).toHaveLength(11);
    expect(new Set(r.state.lineup).size).toBe(11);
    expect(r.state.lineup).not.toContain("fantasma");
    expect(r.state.fixtures.length).toBe(s.fixtures.length + 1);
    expect(r.state.approval).toBe(100);
    expect(repairCareer(r.state).fixes).toEqual([]);
  });
});
