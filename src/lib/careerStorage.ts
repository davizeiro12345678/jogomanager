import type { CareerState } from "@/game/types";

const KEY = "manager3d.career.v1";

export function readLocalCareer(): CareerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CareerState) : null;
  } catch {
    return null;
  }
}

export function writeLocalCareer(state: CareerState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — game keeps running in memory */
  }
}

export function clearLocalCareer() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
