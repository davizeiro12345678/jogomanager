/** Decisions use Auth's assurance state and verified factors, never user_metadata. */
export function needsMfaChallenge(level: {
  currentLevel: string | null;
  nextLevel: string | null;
}): boolean {
  return level.nextLevel === "aal2" && level.currentLevel !== "aal2";
}

/** Call only with verified JWT claims and a server-validated Auth user. */
export function sessionMeetsMfa(
  assurance: unknown,
  factors: readonly { status: string }[] = [],
): boolean {
  return assurance === "aal2" || !factors.some((factor) => factor.status === "verified");
}
