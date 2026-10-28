/**
 * Official crests / kit images imported from the football APIs.
 *
 * Loaded once per session (with a localStorage cache so the game stays fast
 * and works offline) and switchable off from the settings toggle, in which
 * case the game falls back to its own hand-drawn crests.
 */
import type { OfficialAssets } from "./football.functions";
import { reportSilent } from "./silent-errors";
import { get, set } from "idb-keyval";

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
function reportCacheError(error: unknown, phase: "read" | "write" | "load") {
  reportSilent("assets.cache", error, {
    classification: phase === "write" ? "ignorable" : "degradation",
    feature: "official-assets",
    phase,
    dedupeKey: `official-assets-${phase}`,
  });
}
async function readCache(): Promise<OfficialAssets | null> {
  const validData = (value: unknown): OfficialAssets | null => {
    if (!value || typeof value !== "object") return null;
    const parsed = value as { at?: unknown; data?: Partial<OfficialAssets> };
    return typeof parsed.at === "number" &&
      Number.isFinite(parsed.at) &&
      Date.now() - parsed.at <= TTL &&
      parsed.data &&
      stringRecord(parsed.data.crests) &&
      stringRecord(parsed.data.kits)
      ? (parsed.data as OfficialAssets)
      : null;
  };
  try {
    const indexed = validData(await get(CACHE_KEY));
    if (indexed) return indexed;
  } catch {
    // An existing offline catalogue remains usable if IndexedDB is denied.
  }
  try {
    if (typeof localStorage === "undefined") return null;
    return validData(JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null"));
  } catch (error) {
    reportCacheError(error, "read");
    return null;
  }
}

/** Kick off the load; safe to call from anywhere, runs at most once. */
export function loadOfficialAssets(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const cached = await readCache();
      if (cached) cache = cached;
      else {
        // Isolated/local crest rendering never initializes the server runtime.
        const { getOfficialAssets } = await import("./football.functions");
        const data = await getOfficialAssets();
        if (data && (Object.keys(data.crests).length || Object.keys(data.kits).length)) {
          cache = data;
          // Persist the structured catalogue asynchronously. Synchronous JSON +
          // localStorage writes stalled the selection UI on slower devices.
          void set(CACHE_KEY, { at: Date.now(), data }).catch((error) => {
            reportCacheError(error, "write");
          });
        }
      }
      loaded = true;
      listeners.forEach((l) => l());
    } catch (error) {
      reportCacheError(error, "load");
      // A failed request did not load a catalog. A later explicit load may
      // recover; simultaneous callers still share the in-flight request.
      loaded = false;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
