import type { CareerState, Player } from "./types";
import type { WeekActionId } from "./season-mode";

/** Read once per save revision; UI never modifies the source players. */
export function summarizeCoachSquad(career: CareerState) {
  const players: Player[] = [];
  let captain: Player | undefined;
  let morale = 0;
  let condition = 0;
  let form = 0;
  for (const player of Object.values(career.players)) {
    if (player.clubId !== career.clubId) continue;
    players.push(player);
    morale += player.morale;
    condition += player.condition;
    form += player.form ?? 60;
    if (!captain || player.ovr > captain.ovr) captain = player;
  }
  const count = players.length || 1;
  return {
    players,
    captain,
    morale: morale / count,
    condition: condition / count,
    form: form / count,
  };
}

export function suggestedWeekAction(
  summary: ReturnType<typeof summarizeCoachSquad>,
  pressure: number,
): WeekActionId {
  if (summary.condition < 65) return "descanso";
  if (summary.morale < 60) return "conversa";
  if (pressure >= 70) return "imprensa";
  return "treino-tatico";
}

/** Existing durable match logs survive reloads; no duplicate session feed. */
export function coachResults(career: CareerState) {
  return (career.matchLog ?? [])
    .filter((entry) => !entry.clubId || entry.clubId === career.clubId)
    .slice(0, 20);
}
