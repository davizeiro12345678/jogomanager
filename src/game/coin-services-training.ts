import type { CareerState } from "./types";
import { buildReadySquad } from "./career";
import { getLeague } from "./data/leagues";
import { TRAINING_UPGRADE_RATE } from "@/lib/wallet-rules";

export const trainingRoundKey = (career: Pick<CareerState, "season" | "round">) =>
  `${career.season}-${career.round}`;

export function canUpgradeTraining(career: CareerState): boolean {
  const key = trainingRoundKey(career);
  return career.trainingUpgradeRound !== key && !career.drillsByRound?.[key];
}

export function applyTrainingUpgrade(career: CareerState): CareerState {
  return canUpgradeTraining(career)
    ? { ...career, trainingUpgradeRound: trainingRoundKey(career) }
    : career;
}

export function trainingUpgradeMultiplier(
  career: Pick<CareerState, "season" | "round" | "trainingUpgradeRound">,
): number {
  return career.trainingUpgradeRound === trainingRoundKey(career) ? 1 + TRAINING_UPGRADE_RATE : 1;
}

/** Reveals one existing career player, never a newly generated duplicate. */
export function premiumScoutCandidates(career: CareerState) {
  const known = new Set(career.scoutReports.map((report) => report.playerId));
  const players = new Map(Object.values(career.players).map((player) => [player.id, player]));
  // Populate only the active league. Persisted players win, preserving transfers
  // and development instead of replacing them with original catalogue values.
  for (const club of getLeague(career.leagueId).clubs) {
    if (club.id === career.clubId) continue;
    for (const player of buildReadySquad(club.id)) {
      if (!players.has(player.id)) players.set(player.id, player);
    }
  }
  return [...players.values()]
    .filter((player) => player.clubId !== career.clubId && !known.has(player.id))
    .sort((a, b) => (b.potential ?? b.ovr) - (a.potential ?? a.ovr));
}

export function applyPremiumScout(career: CareerState, playerId: string): CareerState {
  const player =
    career.players[playerId] ??
    premiumScoutCandidates(career).find((candidate) => candidate.id === playerId);
  if (
    !player ||
    player.clubId === career.clubId ||
    career.scoutReports.some((report) => report.playerId === playerId)
  )
    return career;
  return {
    ...career,
    scoutReports: [
      {
        id: `premium-${player.id}-${career.season}`,
        playerId: player.id,
        name: player.name,
        clubId: player.clubId,
        pos: player.pos,
        age: player.age,
        ovr: player.ovr,
        potential: player.potential ?? player.ovr,
        value: player.value,
        season: career.season,
      },
      ...career.scoutReports,
    ].slice(0, 40),
  };
}
