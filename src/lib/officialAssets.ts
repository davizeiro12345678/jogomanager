/**
 * Official crests / kit images imported from the football APIs.
 *
 * Loaded once per session (with a localStorage cache so the game stays fast
 * and works offline) and switchable off from the settings toggle, in which
 * case the game falls back to its own hand-drawn crests.
 */
import type { OfficialAssets } from "./football.functions";

const PREF_KEY = "manager3d.officialLook";

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

/** Kick off the load; safe to call from anywhere, runs at most once. */
export function loadOfficialAssets(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { readOrFetchOfficialAssets } = await import("./official-assets-loader");
      cache = await readOrFetchOfficialAssets();
      loaded = true;
      listeners.forEach((l) => l());
    } catch (error) {
      // A failed optional chunk must not fail the picker. Diagnostics is lazy
      // too, so synchronous crest readers retain no storage/telemetry imports.
      void import("./silent-errors")
        .then(({ reportSilent }) =>
          reportSilent("assets.cache", error, {
            classification: "degradation",
            feature: "official-assets",
            phase: "load",
            dedupeKey: "official-assets-load",
          }),
        )
        .catch(() => undefined);
      // A failed request did not load a catalog. A later explicit load may
      // recover; simultaneous callers still share the in-flight request.
      loaded = false;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Keep optional catalogue parsing off the initial quick-picker hydration. */
export function deferOfficialAssets(): () => void {
  if (typeof window === "undefined" || loaded) return () => {};
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(() => void loadOfficialAssets(), { timeout: 2500 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(() => void loadOfficialAssets(), 1500);
  return () => window.clearTimeout(handle);
}
