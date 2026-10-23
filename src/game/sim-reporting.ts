import { calculatePlayerRatings } from "./sim-ratings";
import type { SimPlayer, MatchStats, Side } from "./sim-contracts";
export function rateMatchPlayers(
  players: SimPlayer[],
  subsOut: SimPlayer[],
  stats: Record<Side, MatchStats>,
  minute: number,
) {
  return calculatePlayerRatings(players, subsOut, minute, stats);
}
