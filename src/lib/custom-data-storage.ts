// Reading a campaign's overrides does not need the football catalogue or renderer.
import { scopedKey } from "./world-scope";
import type { CustomData } from "./customData";
const EMPTY: CustomData = { clubs: {}, players: [], competitions: [] };
export function readCustom(): CustomData {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(scopedKey("manager3d.custom.v1"));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CustomData>;
    return {
      clubs: parsed.clubs ?? {},
      players: parsed.players ?? [],
      competitions: parsed.competitions ?? [],
    };
  } catch {
    return EMPTY;
  }
}
