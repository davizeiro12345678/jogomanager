import type { PlayerCareerState } from "@/game/player-career/types";

/** Export a local save as JSON before choosing between divergent cloud copies. */
export function downloadAthlete(state: PlayerCareerState, label = "carreira-jogador"): void {
  const text = JSON.stringify(state, null, 2);
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${label}-${state.slot}-temporada-${state.season}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Some browsers still need the object URL until the click completes.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
