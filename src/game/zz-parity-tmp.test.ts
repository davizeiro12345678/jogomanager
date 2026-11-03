import { it, expect } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import { MatchSim as Base } from "./zz-sim-baseline-tmp";
const pairs: [string, string][] = [["fla","pal"],["pal","fla"],["fla","fla"]];
it("set-piece split keeps 30 matches identical", () => {
  let n = 0;
  for (let i = 0; i < 10; i++) for (const [h, a] of pairs) {
    const seed = `parity-${i}`;
    const x = new MatchSim(buildTeamSetup(h), buildTeamSetup(a), seed);
    const y = new Base(buildTeamSetup(h), buildTeamSetup(a), seed);
    while (!x.finished) x.step(0.25);
    while (!y.finished) y.step(0.25);
    expect(x.stats).toEqual(y.stats);
    expect(x.scorers).toEqual(y.scorers);
    expect(x.shotMap).toEqual(y.shotMap);
    expect(JSON.stringify(x.checkpoint())).toBe(JSON.stringify(y.checkpoint()));
    n += x.stats.home.shots + x.stats.away.shots;
  }
  console.log("PARITY_OK shots", n);
});
