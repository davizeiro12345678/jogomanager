import { scopedKey } from "./world-scope";
import type { MyClub } from "./myClub";

/** Reading a club identity must not initialize the mutable game catalogue. */
export function readMyClub(): MyClub | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(scopedKey("manager3d.myclub.v1"));
    return raw ? (JSON.parse(raw) as MyClub) : null;
  } catch {
    return null;
  }
}
