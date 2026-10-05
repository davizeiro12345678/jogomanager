import { it } from "vitest";
import { autoSeason } from "./autoplay";
import { initCareer } from "./career";
import { getLeague } from "./data/leagues";
it("prof", () => {
  const s = initCareer("bra", getLeague("bra").clubs[0]!.id, "Teste");
  console.log("fixtures", s.fixtures.length);
  const t = performance.now();
  const r = autoSeason(s, 60);
  console.log("weeks", r.weeks.length, "ms", Math.round(performance.now() - t));
}, 300000);
