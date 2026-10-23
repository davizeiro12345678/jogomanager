import { FORMATIONS } from "./formations";
import { physiqueFor } from "./player-physique";
import { matchAttributes } from "./match-readiness";
import { FIELD_X, FIELD_Z } from "./sim-rules";
import type { TeamSetup, Side, SimPlayer } from "./sim-types";
export function buildSimTeam(setup: TeamSetup, side: Side, seed: string): SimPlayer[] {
  const slots = FORMATIONS[setup.tactics.formation];
  const dir = side === "home" ? 1 : -1;
  return setup.players.slice(0, 11).map((p, i) => {
    const slot = slots[Math.min(i, slots.length - 1)]!;
    const physique = physiqueFor(p);
    const x = slot.x * FIELD_X * 0.92 * dir;
    const z = slot.z * FIELD_Z * 0.8 * dir;
    return {
      id: `${side}-${p.id}`,
      side,
      name: p.name,
      number: p.number,
      pos: p.pos,
      heightCm: physique.height,
      weightKg: physique.weight,
      x,
      z,
      vx: 0,
      vz: 0,
      slotX: slot.x * dir,
      slotZ: slot.z * dir,
      ...matchAttributes(p, seed, side),
      action: null,
      actionT: 0,
      actionDur: 0,
      pid: p.id,
      goals: 0,
      assists: 0,
      shots: 0,
      passes: 0,
      tackles: 0,
      saves: 0,
      onSince: 0,
      minutes: 0,
      yellows: 0,
      sentOff: false,
      injuryWeeks: 0,
      interceptions: 0,
      offsides: 0,
      foulsWon: 0,
      pensScored: 0,
      pensMissed: 0,
      xg: 0,
    };
  });
}

/** Shared initial/restart position; this consumes no match RNG. */
export function placeKickoffStarter(players: SimPlayer[], side: Side): SimPlayer {
  const team = players.filter((player) => player.side === side && !player.sentOff);
  const starter = team.find((player) => player.pos === "FW") ?? team[team.length - 1]!;
  starter.x = -0.6 * (side === "home" ? 1 : -1);
  starter.z = 0;
  return starter;
}
