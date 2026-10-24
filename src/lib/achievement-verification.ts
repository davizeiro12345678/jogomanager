import { evaluateAchievements } from "@/game/achievements";
import { initCareer } from "@/game/career/setup";
import { verifyCareerProgress } from "./career-verification";

/**
 * Reconstruct even an attested initial save: ancillary client fields (records,
 * academy, manager history, players and achievement ids) cannot confer awards.
 * Played careers require a future server-owned event/replay attestation flow.
 */
export function evaluateServerAchievements(value: unknown, verified: unknown): string[] {
  if (verified !== true || !verifyCareerProgress(value)) return [];
  return evaluateAchievements(initCareer(value.leagueId, value.clubId, value.managerName));
}
