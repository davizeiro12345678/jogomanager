/** Monta um time completo (elenco + escalação) só a partir do id do clube. */
import { buildReadySquad, pickLineup } from "./career";
import { safeClub } from "./squad";
import type { TeamSetup } from "./sim";
import type { FormationKey, Player } from "./types";

export type Difficulty = "facil" | "normal" | "dificil";

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
  const lineupIds = new Set(lineup);
  const bench = squad.filter((p) => !lineupIds.has(p.id));
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
