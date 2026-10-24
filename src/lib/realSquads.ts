/**
 * Real squads imported from the football APIs.
 * Fetched on demand (when the player picks a club) and cached in
 * localStorage so a career keeps the real names even offline.
 */
import { getRealSquad } from "./football.functions";
import { normalizeRealPlayers } from "./real-player-records";

export interface RealPlayer {
  canonical_player_id?: string | null;
  source_kind?: "player" | "athlete" | "coach" | "staff";
  raw_position?: string | null;
  id?: string;
  data_source?: string | null;
  source_id?: string | null;
  birth_date?: string | null;
  identity_aliases?: string[];
  name: string;
  position: string;
  age: number;
  shirt_number: number | null;
  nationality: string | null;
  overall: number;
  photo_url: string | null;
}

// v2 may contain a truncated response. Keep it as an offline identity fallback
// while v3 records freshness and revalidates the complete paginated squad.
const KEY = "manager3d.realsquads.v3";
const LEGACY_KEY = "manager3d.realsquads.v2";
type SquadEntry = { rows: RealPlayer[]; at: number };
const memory = new Map<string, SquadEntry>();
const inflight = new Map<string, Promise<RealPlayer[]>>();
const emptyUntil = new Map<string, number>();
const EMPTY_TTL_MS = 60_000;
const SQUAD_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_MEMORY_CLUBS = 128;

function remember(clubId: string, entry: SquadEntry) {
  memory.delete(clubId);
  memory.set(clubId, entry);
  while (memory.size > MAX_MEMORY_CLUBS) memory.delete(memory.keys().next().value!);
}

function readStore(key = KEY): Record<string, unknown> {
  if (typeof localStorage === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, unknown>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore quota errors */
  }
}

function cachedSquad(clubId: string): SquadEntry | undefined {
  const mem = memory.get(clubId);
  if (mem) {
    remember(clubId, mem);
    return mem;
  }
  const stored = readStore()[clubId];
  if (stored && typeof stored === "object" && "rows" in stored && "at" in stored) {
    const at = stored.at;
    if (typeof at === "number" && Number.isFinite(at) && at > 0 && at <= Date.now()) {
      const rows = normalizeRealPlayers(stored.rows, clubId);
      if (rows.length) {
        const entry = { rows, at };
        remember(clubId, entry);
        return entry;
      }
    }
  }
  const legacy = normalizeRealPlayers(readStore(LEGACY_KEY)[clubId], clubId);
  if (!legacy.length) return undefined;
  const entry = { rows: legacy, at: 0 };
  remember(clubId, entry);
  return entry;
}

/** Synchronous read used while building a squad, including stale offline IDs. */
export function realSquadFor(clubId: string): RealPlayer[] {
  return cachedSquad(clubId)?.rows ?? [];
}

/** Fetch and cache the real squad for a club. Safe to call repeatedly. */
export function loadRealSquad(clubId: string): Promise<RealPlayer[]> {
  const cached = cachedSquad(clubId);
  const fallback = cached?.rows ?? [];
  if (cached && cached.at > 0 && Date.now() - cached.at < SQUAD_TTL_MS)
    return Promise.resolve(cached.rows);
  if ((emptyUntil.get(clubId) ?? 0) > Date.now()) return Promise.resolve(fallback);
  const pending = inflight.get(clubId);
  if (pending) return pending;
  const request = (async () => {
    try {
      const rows = normalizeRealPlayers(await getRealSquad({ data: { clubId } }), clubId);
      if (rows.length) {
        const entry = { rows, at: Date.now() };
        remember(clubId, entry);
        emptyUntil.delete(clubId);
        writeStore({ ...readStore(), [clubId]: entry });
        return rows;
      }
      // Empty imported clubs are common. Avoid a request on every selection,
      // but retry soon enough to pick up a newly completed import.
      emptyUntil.delete(clubId);
      emptyUntil.set(clubId, Date.now() + EMPTY_TTL_MS);
      while (emptyUntil.size > MAX_MEMORY_CLUBS) emptyUntil.delete(emptyUntil.keys().next().value!);
    } catch {
      // An offline/provider failure is not a successful empty squad. The next
      // attempt is allowed immediately. Existing real IDs remain available
      // offline instead of being replaced by a generated fallback squad.
    }
    return fallback;
  })().finally(() => {
    if (inflight.get(clubId) === request) inflight.delete(clubId);
  });
  inflight.set(clubId, request);
  return request;
}
