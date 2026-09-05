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
const ids = Object.keys(CLUBS);
const sim: any = new MatchSim(setup(ids[0]!), setup(ids[1]!), "dbg");
console.log("players", sim.players.length, sim.players.slice(0,3).map((p:any)=>[p.name,p.pos,p.x.toFixed(1),p.z.toFixed(1)]));
for (let i = 0; i < 400; i++) sim.step(0.1);
const holder = sim.ball.holder;
console.log("t", sim.time, "holder", holder, "ball", sim.ball.x.toFixed(1), sim.ball.z.toFixed(1), "poss", sim.possession);
console.log("events", sim.events.slice(-4).map((e:any)=>e.text));
const h = sim.players.find((p:any)=>p.id===holder);
if (h) console.log("holder", h.name, h.pos, h.x.toFixed(1), h.z.toFixed(1), "dist goal", Math.hypot((h.side==="home"?1:-1)*52.5-h.x, h.z).toFixed(1));
console.log("decisionTimer", sim.decisionTimer, "restartTimer", sim.restartTimer);
