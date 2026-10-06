import type { PlayerCareerState } from "@/game/player-career/types";

const KEY = (slot: number) => `manager3d.athlete.v1.${slot}`;
export const ATHLETE_SLOTS = [1, 2, 3] as const;

export function readAthlete(slot: number): PlayerCareerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY(slot));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerCareerState;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function writeAthlete(state: PlayerCareerState) {
  window.localStorage.setItem(KEY(state.slot), JSON.stringify(state));
}

export function deleteAthlete(slot: number) {
  window.localStorage.removeItem(KEY(slot));
}

export function listAthletes(): (PlayerCareerState | null)[] {
  return ATHLETE_SLOTS.map((s) => readAthlete(s));
}
