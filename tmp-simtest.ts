import { MatchSim } from "@/game/sim";
import { CLUBS } from "@/game/data/leagues";
import { buildSquad } from "@/game/squad";
import { pickLineup } from "@/game/career";
import type { TeamSetup } from "@/game/sim";
function setup(id: string): TeamSetup {
  const c = CLUBS[id]!;
  const sq = buildSquad(id);
  const { lineup } = pickLineup(sq, "4-3-3");
  const byId = Object.fromEntries(sq.map((p) => [p.id, p]));
  return { clubId: id, name: c.name, short: c.short, primary: c.primary, secondary: c.secondary,
    players: lineup.map((i) => byId[i]!), tactics: { formation: "4-3-3", mentality: 2, pressing: 1, width: 1, tempo: 1 } };
}
const ids = Object.keys(CLUBS).slice(0, 8);
for (const dt of [0.05, 0.3, 0.4]) {
  let g = 0, s = 0, n = 0;
  for (let i = 0; i + 1 < ids.length; i += 2) {
    const sim = new MatchSim(setup(ids[i]!), setup(ids[i + 1]!), "seed" + i + dt);
    while (!sim.finished) sim.step(dt);
    g += sim.stats.home.goals + sim.stats.away.goals;
    s += sim.stats.home.shots + sim.stats.away.shots;
    n++;
  }
  console.log("dt", dt, "gols/jogo", (g / n).toFixed(2), "chutes/jogo", (s / n).toFixed(1));
}
