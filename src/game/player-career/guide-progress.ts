import type { PlayerCareerState } from "./types";

/** Guidance follows committed reports, not tab visits or unplayed pending moments. */
export function playerGuideProgress(
  state: Pick<PlayerCareerState, "lastMatch" | "recent" | "current" | "history">,
) {
  const weekPlayed =
    state.lastMatch !== null || state.recent.length > 0 || state.history.length > 0;
  const appeared = state.current.apps > 0 || state.history.some((season) => season.apps > 0);
  return { weekPlayed, appeared, completed: Number(weekPlayed) + Number(appeared), total: 2 };
}
