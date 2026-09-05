/**
 * Real squads imported from the football APIs.
 * Fetched on demand (when the player picks a club) and cached in
 * localStorage so a career keeps the real names even offline.
 */
import { getRealSquad } from "./football.functions";

export interface RealPlayer {
  name: string;
  position: string;
  age: number;
  shirt_number: number | null;
  nationality: string | null;
  overall: number;
  photo_url: string | null;
}

const KEY = "manager3d.realsquads.v1";
const memory = new Map<string, RealPlayer[]>();

function readStore(): Record<string, RealPlayer[]> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, RealPlayer[]>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, RealPlayer[]>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore quota errors */
  }
}

/** Synchronous read used while building a squad. */
export function realSquadFor(clubId: string): RealPlayer[] {
  const mem = memory.get(clubId);
  if (mem) return mem;
  const stored = readStore()[clubId];
  if (stored) {
    memory.set(clubId, stored);
    return stored;
  }
  return [];
}

/** Fetch and cache the real squad for a club. Safe to call repeatedly. */
export async function loadRealSquad(clubId: string): Promise<RealPlayer[]> {
  const cached = realSquadFor(clubId);
  if (cached.length) return cached;
  try {
    const rows = (await getRealSquad({ data: { clubId } })) as RealPlayer[];
    if (rows?.length) {
      memory.set(clubId, rows);
      const store = readStore();
      store[clubId] = rows;
      writeStore(store);
      return rows;
    }
  } catch {
    /* offline: fall back to generated names */
  }
  return [];
}
