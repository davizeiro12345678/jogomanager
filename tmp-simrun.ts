import { MatchSim } from "@/game/sim";
import { CLUBS } from "@/game/data/leagues";
import { buildSquad } from "@/game/squad";
import { pickLineup } from "@/game/career";
import type { TeamSetup } from "@/game/sim";
function setup(id: string): TeamSetup {
  const c = CLUBS[id]!; const sq = buildSquad(id);
  const { lineup } = pickLineup(sq, "4-3-3");
  const byId = Object.fromEntries(sq.map((p) => [p.id, p]));
  return { clubId: id, name: c.name, short: c.short, primary: c.primary, secondary: c.secondary,
    players: lineup.map((i) => byId[i]!), tactics: { formation: "4-3-3", mentality: 2, pressing: 1, width: 1, tempo: 1 } };
}
const ids = Object.keys(CLUBS);
for (let m = 0; m < 5; m++) {
  const sim = new MatchSim(setup(ids[m*2]!), setup(ids[m*2+1]!), "run"+m);
  while (!sim.finished) sim.step(0.05);
  console.log(m, "placar", sim.stats.home.goals, "x", sim.stats.away.goals,
    "chutes", sim.stats.home.shots, sim.stats.away.shots, "poss", sim.possessionPct().join("/"));
}
