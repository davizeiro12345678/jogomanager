import { CLUBS } from "../src/game/data/leagues";
import { buildSquad } from "../src/game/squad";
import type { TeamSetup } from "../src/game/sim";
export function benchmarkTeam(clubId: string): TeamSetup {
  const club = CLUBS[clubId]!;
  return {
    clubId,
    name: club.name,
    short: club.short,
    primary: club.primary,
    secondary: club.secondary,
    players: buildSquad(clubId).slice(0, 11),
    tactics: { formation: "4-3-3", mentality: 2, pressing: 1, width: 1, tempo: 1 },
  };
}
