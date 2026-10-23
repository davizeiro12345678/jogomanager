/**
 * Official crests / kit images imported from the football APIs.
 *
 * Loaded once per session (with a localStorage cache so the game stays fast
 * and works offline) and switchable off from the settings toggle, in which
 * case the game falls back to its own hand-drawn crests.
 */
import type { OfficialAssets } from "./football.functions";
import { reportSilent } from "./silent-errors";

// v1 could contain a Data API-truncated catalog. Fetch it completely once.
const CACHE_KEY = "manager3d.official.v3";
const PREF_KEY = "manager3d.officialLook";
const TTL = 1000 * 60 * 60 * 24;

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

function stringRecord(value: unknown): value is Record<string, string> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}
function readCache(): OfficialAssets | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: OfficialAssets };
    if (
      !Number.isFinite(parsed.at) ||
      Date.now() - parsed.at > TTL ||
      !parsed.data ||
      !stringRecord(parsed.data.crests) ||
      !stringRecord(parsed.data.kits)
    )
      return null;
    return parsed.data;
  } catch (error) {
    reportSilent("assets.cache", error, {
      classification: "degradation",
      feature: "official-assets",
      phase: "read",
      dedupeKey: "official-assets-read",
    });
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
    return Promise.resolve();
  }

  // The local crest renderer and isolated graphics previews do not need to
  // initialize the server-function runtime just to import this cache.
  inflight = import("./football.functions")
    .then(({ getOfficialAssets }) => getOfficialAssets())
    .then((data) => {
      if (data && (Object.keys(data.crests).length || Object.keys(data.kits).length)) {
        cache = data;
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
        } catch (error) {
          reportSilent("assets.cache", error, {
            classification: "ignorable",
            feature: "official-assets",
            phase: "write",
            dedupeKey: "official-assets-write",
          });
        }
      }
      loaded = true;
      listeners.forEach((l) => l());
    })
    .catch((error) => {
      reportSilent("assets.cache", error, {
        classification: "degradation",
        feature: "official-assets",
        phase: "load",
        dedupeKey: "official-assets-load",
      });
      // A failed request did not load a catalog. A later explicit load may
      // recover; simultaneous callers still share the in-flight request.
      loaded = false;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
