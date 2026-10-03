import { describe, expect, it } from "vitest";
import { quickSimulate } from "./career";
import { LEAGUES } from "./data/leagues";

describe("calibração dos resultados (2.000 partidas)", () => {
  it("médias ficam perto do futebol real", () => {
    let g = 0, d = 0, hw = 0, big = 0, n = 0;
    for (let i = 0; i < 2000; i++) {
      const L = LEAGUES[i % 12]!.clubs;
      const h = L[i % L.length]!.id, a = L[(i * 7 + 3) % L.length]!.id;
      if (h === a) continue;
      const r = quickSimulate(h, a, `cal-${i}`);
      n++; g += r.hg + r.ag;
      if (r.hg === r.ag) d++;
      if (r.hg > r.ag) hw++;
      if (Math.abs(r.hg - r.ag) >= 4) big++;
      expect(r.events.filter((e) => e.kind !== "vermelho").length).toBe(r.hg + r.ag);
    }
    expect(g / n).toBeGreaterThan(2.3);
    expect(g / n).toBeLessThan(2.9);
    expect(d / n).toBeGreaterThan(0.2);
    expect(d / n).toBeLessThan(0.31);
    expect(hw / n).toBeGreaterThan(0.4);
    expect(hw / n).toBeLessThan(0.52);
    expect(big / n).toBeLessThan(0.07);
  });
  it("time em má forma e cansado rende menos", () => {
    const L = LEAGUES[0]!.clubs;
    let good = 0, bad = 0;
    for (let i = 0; i < 1500; i++) {
      good += quickSimulate(L[0]!.id, L[1]!.id, `f${i}`, { homeForm: 90 }).hg;
      bad += quickSimulate(L[0]!.id, L[1]!.id, `f${i}`, { homeForm: 30, homeFatigue: 80 }).hg;
    }
    expect(good).toBeGreaterThan(bad);
  });
  it("táticas agressivas criam mais chances para ambos os lados, de forma determinística", () => {
    const [home, away] = LEAGUES[0]!.clubs;
    const attacking = { mentality: 4, pressing: 2, tempo: 2 } as const;
    let neutralHome = 0, neutralAway = 0, riskyHome = 0, riskyAway = 0;
    for (let i = 0; i < 2000; i++) {
      const seed = `tactics-${i}`;
      const base = quickSimulate(home!.id, away!.id, seed);
      const risk = quickSimulate(home!.id, away!.id, seed, { homeTactics: attacking });
      expect(quickSimulate(home!.id, away!.id, seed, { homeTactics: attacking })).toEqual(risk);
      neutralHome += base.hg;
      neutralAway += base.ag;
      riskyHome += risk.hg;
      riskyAway += risk.ag;
    }
    expect(riskyHome).toBeGreaterThan(neutralHome);
    expect(riskyAway).toBeGreaterThan(neutralAway);
  });
});
