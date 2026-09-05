/** Monta um time completo (elenco + escalação) só a partir do id do clube. */
import { CLUBS } from "./data/leagues";
import { buildSquad } from "./squad";
import { pickLineup } from "./career";
import type { TeamSetup } from "./sim";
import type { FormationKey, Player } from "./types";

export type Difficulty = "facil" | "normal" | "dificil";

export function buildTeamSetup(
  clubId: string,
  formation: FormationKey = "4-3-3",
  mentality = 2,
  pressing = 1,
): TeamSetup {
  const club = CLUBS[clubId]!;
  const squad = buildSquad(clubId);
  const { lineup } = pickLineup(squad, formation);
  const byId = Object.fromEntries(squad.map((p) => [p.id, p]));
  return {
    clubId,
    name: club.name,
    short: club.short,
    primary: club.primary,
    secondary: club.secondary,
    players: lineup.map((id) => byId[id]!).filter(Boolean) as Player[],
    tactics: { formation, mentality, pressing, width: 1, tempo: 1 },
  };
}

/** A dificuldade muda a postura do adversário controlado pelo computador. */
export function aiTactics(d: Difficulty) {
  if (d === "facil") return { mentality: 1, pressing: 0 };
  if (d === "dificil") return { mentality: 3, pressing: 2 };
  return { mentality: 2, pressing: 1 };
}
