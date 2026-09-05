/**
 * Official crests / kit images imported from the football APIs.
 *
 * Loaded once per session (with a localStorage cache so the game stays fast
 * and works offline) and switchable off from the settings toggle, in which
 * case the game falls back to its own hand-drawn crests.
 */
import { getOfficialAssets, type OfficialAssets } from "./football.functions";

const CACHE_KEY = "manager3d.official.v1";
const PREF_KEY = "manager3d.officialLook";
const TTL = 1000 * 60 * 60 * 24 * 7;

let cache: OfficialAssets = { crests: {}, kits: {} };
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function officialLookEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(PREF_KEY) !== "off";
}

export function setOfficialLook(on: boolean) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PREF_KEY, on ? "on" : "off");
  listeners.forEach((l) => l());
}

export function subscribeOfficial(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function officialCrest(clubId: string): string | undefined {
  if (!officialLookEnabled()) return undefined;
  return cache.crests[clubId];
}

export function officialKit(clubId: string): string | undefined {
  if (!officialLookEnabled()) return undefined;
  return cache.kits[clubId];
}

function readCache(): OfficialAssets | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: OfficialAssets };
    if (Date.now() - parsed.at > TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/** Kick off the load; safe to call from anywhere, runs at most once. */
export function loadOfficialAssets(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (inflight) return inflight;

  const cached = readCache();
  if (cached) {
    cache = cached;
    loaded = true;
    listeners.forEach((l) => l());
  }

  inflight = getOfficialAssets()
    .then((data) => {
      if (data && (Object.keys(data.crests).length || Object.keys(data.kits).length)) {
        cache = data;
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
        } catch {
          /* storage full — memory cache still works */
        }
      }
      loaded = true;
      listeners.forEach((l) => l());
    })
    .catch(() => {
      loaded = true;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
