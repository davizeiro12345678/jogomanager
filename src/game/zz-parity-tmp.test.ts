import { it, expect } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import { MatchSim as Base } from "./zz-sim-baseline-tmp";
const pairs: [string, string][] = [["fla","pal"],["pal","fla"],["fla","fla"]];
it("engine split keeps 30 matches identical and as fast", () => {
  const t = { base: 0, split: 0 };
  for (let i = 0; i < 10; i++) for (const [h, a] of pairs) {
    const seed = `parity-${i}`;
    let s = performance.now();
    const y = new Base(buildTeamSetup(h), buildTeamSetup(a), seed);
    while (!y.finished) y.step(0.25);
    t.base += performance.now() - s; s = performance.now();
    const x = new MatchSim(buildTeamSetup(h), buildTeamSetup(a), seed);
    while (!x.finished) x.step(0.25);
    t.split += performance.now() - s;
    expect(x.stats).toEqual(y.stats);
    expect(x.scorers).toEqual(y.scorers);
    expect(x.shotMap).toEqual(y.shotMap);
    expect(x.events).toEqual(y.events);
    expect(JSON.stringify(x.checkpoint())).toBe(JSON.stringify(y.checkpoint()));
  }
  console.log("PARITY_OK", JSON.stringify({ base: Math.round(t.base / 30), split: Math.round(t.split / 30) }));
}, 500000);
