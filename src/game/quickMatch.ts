/** Monta um time completo (elenco + escalação) só a partir do id do clube. */
import { buildReadySquad, pickLineup } from "./career/squad";
import { safeClub } from "./squad";
import type { TeamSetup } from "./sim-types";
import type { FormationKey, Player } from "./types";
import { MAX_MATCH_BENCH_PLAYERS, validMatchPlayer } from "./match-command-validation";

export type Difficulty = "facil" | "normal" | "dificil";

/** Register a bounded match bench without changing the career roster. */
export function buildMatchBench(
  clubId: string,
  candidates: readonly Player[],
  lineup: readonly string[],
): Player[] {
  const registered = new Set(lineup);
  const bench: Player[] = [];
  for (const player of candidates) {
    if (
      !validMatchPlayer(player) ||
      player.clubId !== clubId ||
      registered.has(player.id) ||
      player.injuryWeeks !== 0 ||
      player.suspended
    )
      continue;
    registered.add(player.id);
    bench.push(player);
    if (bench.length === MAX_MATCH_BENCH_PLAYERS) break;
  }
  return bench;
}

export function buildTeamSetup(
  clubId: string,
  formation: FormationKey = "4-3-3",
  mentality = 2,
  pressing = 1,
  opts?: { cpu?: boolean; morale?: number },
): TeamSetup {
  const club = safeClub(clubId);
  const squad = buildReadySquad(clubId);
  const { lineup } = pickLineup(squad, formation);
  const byId = Object.fromEntries(squad.map((p) => [p.id, p]));
  const chosen = lineup.map((id) => byId[id]!).filter(Boolean) as Player[];
  const bench = buildMatchBench(clubId, squad, lineup);
  const morale =
    opts?.morale ??
    Math.round(squad.reduce((s, p) => s + (p.morale ?? 70), 0) / Math.max(1, squad.length));
  return {
    clubId,
    name: club.name,
    short: club.short,
    primary: club.primary,
    secondary: club.secondary,
    players: chosen,
    tactics: { formation, mentality, pressing, width: 1, tempo: 1 },
    bench,
    morale,
    cpu: opts?.cpu ?? true,
  };
}

/** A dificuldade muda a postura do adversário controlado pelo computador. */
export function aiTactics(d: Difficulty) {
  if (d === "facil") return { mentality: 1, pressing: 0 };
  if (d === "dificil") return { mentality: 3, pressing: 2 };
  return { mentality: 2, pressing: 1 };
}
