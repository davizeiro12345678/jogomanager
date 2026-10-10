import { autoWeek, type AutoWeek } from "./autoplay";
import type { CareerState } from "./types";
import { validCareerEvaluationTime } from "./match-command-validation";

/** Fallback remains one ordered writer and yields between dependent weeks. */
export async function autoSeasonCooperative(
  state: CareerState,
  maxWeeks = 60,
  evaluatedAt = Date.now(),
  yieldTurn: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 0)),
): Promise<{ weeks: AutoWeek[]; state: CareerState }> {
  if (
    !validCareerEvaluationTime(evaluatedAt) ||
    !Number.isSafeInteger(maxWeeks) ||
    maxWeeks < 0 ||
    maxWeeks > 60
  )
    throw new Error("Parâmetros de temporada inválidos.");
  const weeks: AutoWeek[] = [];
  let current = state;
  for (let index = 0; index < maxWeeks; index++) {
    const week = autoWeek(current, evaluatedAt);
    if (!week) break;
    weeks.push(week);
    current = week.state;
    if (current.season !== state.season || current.sacked) break;
    await yieldTurn();
  }
  return { weeks, state: current };
}
