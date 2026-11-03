import { it, expect } from "vitest";
import * as next from "./career";
import * as base from "./zz-career-baseline-tmp";
import { CLUBS } from "./data/leagues";
it("career split plays two identical seasons", () => {
  for (const club of ["fla", "pal"]) {
    const league = (CLUBS[club] as { league: string }).league;
    let a = base.initCareer(league, club, "Teste");
    let b = next.initCareer(league, club, "Teste");
    b = { ...b, seed: a.seed } as typeof b;
    a = JSON.parse(JSON.stringify(a)); b = JSON.parse(JSON.stringify({ ...a }));
    for (let i = 0; i < 90; i++) {
      const r = { hg: i % 3, ag: (i + 1) % 2 };
      a = base.advanceRound(a, r);
      b = next.advanceRound(b, r);
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    }
    console.log("CAREER_OK", club, a.season, a.round);
  }
}, 500000);
