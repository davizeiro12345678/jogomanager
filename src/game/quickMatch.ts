/** Monta um time completo (elenco + escalação) só a partir do id do clube. */
import { pickLineup } from "./career-lineup";
import { buildReadySquad } from "./career-squad";
import { NAMED_SQUADS } from "./data/squads";
import { safeClub } from "./squad";
import type { TeamSetup } from "./sim";
import type { FormationKey, Player } from "./types";

export type Difficulty = "facil" | "normal" | "dificil";

type CachedTeam = {
  id: string;
  league: string;
  strength: number;
  namedSquad: string | undefined;
  formation: FormationKey;
  players: Player[];
  bench: Player[];
  morale: number;
};
const READY_TEAM_CACHE_LIMIT = 32;
const readyTeams = new Map<string, CachedTeam>();

export function buildTeamSetup(
  clubId: string,
  formation: FormationKey = "4-3-3",
  mentality = 2,
  pressing = 1,
  opts?: { cpu?: boolean; morale?: number; tacticalAiRevision?: 2 },
): TeamSetup {
  const club = safeClub(clubId);
  const namedSquad = NAMED_SQUADS[clubId];
  let team = readyTeams.get(clubId);
  if (
    !team ||
    team.id !== club.id ||
    team.league !== club.league ||
    team.strength !== club.strength ||
    team.namedSquad !== namedSquad ||
    team.formation !== formation
  ) {
    const squad = buildReadySquad(clubId);
    const { lineup } = pickLineup(squad, formation);
    const byId = new Map(squad.map((player) => [player.id, player]));
    const players = lineup.map((id) => byId.get(id)!).filter(Boolean);
    const lineupIds = new Set(lineup);
    const bench = squad.filter((player) => !lineupIds.has(player.id));
    const totalMorale = squad.reduce((sum, player) => sum + (player.morale ?? 70), 0);
    team = {
      id: club.id,
      league: club.league,
      strength: club.strength,
      namedSquad,
      formation,
      players,
      bench,
      morale: Math.round(totalMorale / Math.max(1, squad.length)),
    };
    if (!readyTeams.has(clubId) && readyTeams.size === READY_TEAM_CACHE_LIMIT)
      readyTeams.delete(readyTeams.keys().next().value!);
    readyTeams.set(clubId, team);
  }
  // Catalog players are flat records. Each match still owns its mutable copy.
  return {
    clubId,
    name: club.name,
    short: club.short,
    primary: club.primary,
    secondary: club.secondary,
    players: team.players.map((player) => ({ ...player })),
    tactics: { formation, mentality, pressing, width: 1, tempo: 1 },
    bench: team.bench.map((player) => ({ ...player })),
    morale: opts?.morale ?? team.morale,
    cpu: opts?.cpu ?? true,
    ...(opts?.tacticalAiRevision === 2 ? { tacticalAiRevision: 2 as const } : {}),
  };
}

/** A dificuldade muda a postura do adversário controlado pelo computador. */
export function aiTactics(d: Difficulty) {
  if (d === "facil") return { mentality: 1, pressing: 0 };
  if (d === "dificil") return { mentality: 3, pressing: 2 };
  return { mentality: 2, pressing: 1 };
}
