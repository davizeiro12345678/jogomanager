import { it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import { MatchSim as Base } from "./zz-sim-baseline-tmp";
type Ctor = new (h: ReturnType<typeof buildTeamSetup>, a: ReturnType<typeof buildTeamSetup>, s: string) => { finished: boolean; step(dt: number): void };
function run(C: Ctor, i: number) { const s = new C(buildTeamSetup("fla"), buildTeamSetup("pal"), `t-${i}`); while (!s.finished) s.step(0.25); }
it("timing", () => {
  for (let i = 0; i < 2; i++) { run(Base, i); run(MatchSim, i); }
  const t = { base: 0, split: 0 };
  for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) {
    let a = performance.now(); run(Base, i); t.base += performance.now() - a;
    a = performance.now(); run(MatchSim, i); t.split += performance.now() - a;
  }
  console.log("TIMING", JSON.stringify({ base: Math.round(t.base / 12), split: Math.round(t.split / 12) }));
}, 500000);
